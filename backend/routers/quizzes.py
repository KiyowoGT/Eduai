import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User
from models.quiz import QuizGenerateRequest, QuizSubmission, QuizProgressSave
from deps.auth import get_current_user, write_audit
from services.ai_service import (
    _audience,
    _call_groq,
    generate_quiz_questions,
    _bg_generate_quiz,
    generate_deep_feedback,
    _bg_grade_quiz,
    _emit_quiz_status,
    _emit_result_status
)

logger = logging.getLogger(__name__)
router = APIRouter()

class QuizChatPayload(BaseModel):
    question: str

def _public_quiz(quiz_doc: dict) -> dict:
    out = {k: v for k, v in quiz_doc.items() if k != "_id"}
    if isinstance(out.get("questions"), list):
        out["questions"] = [{k: v for k, v in q.items() if k != "correct_index"} for q in out["questions"]]
    return out

async def _resolve_documents(payload_document_id, payload_document_ids, payload_folder_id, user) -> List[dict]:
    """Resolve a list of ready documents from any of the input shapes."""
    ids: List[str] = []
    if payload_document_ids:
        ids = list(payload_document_ids)
    elif payload_document_id:
        ids = [payload_document_id]
    elif payload_folder_id:
        async for d in db.documents.find(
            {"user_id": user.user_id, "folder_id": payload_folder_id, "status": "ready"},
            {"_id": 0},
        ):
            ids.append(d["document_id"])
    if not ids:
        raise HTTPException(400, "Pilih minimal satu dokumen atau folder")

    docs = []
    async for d in db.documents.find(
        {"document_id": {"$in": ids}, "user_id": user.user_id},
        {"_id": 0, "file_path": 0},
    ):
        docs.append(d)
    if not docs:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    not_ready = [d.get("filename") for d in docs if d.get("status") != "ready"]
    if not_ready:
        raise HTTPException(400, f"Dokumen belum siap: {', '.join(not_ready)}")
    return docs


@router.post("/quiz/generate")
async def quiz_generate(request: Request, payload: QuizGenerateRequest, user: User = Depends(get_current_user)):
    documents = await _resolve_documents(payload.document_id, payload.document_ids, payload.folder_id, user)

    recap_text = ""
    if payload.recap_id:
        recap = await db.recaps.find_one({"recap_id": payload.recap_id, "user_id": user.user_id})
        if recap:
            recap_text = recap.get("unified_summary", "") or ""
            if not recap_text and recap.get("per_document_summaries"):
                recap_text = "\n".join(recap["per_document_summaries"].values())

    quiz_id = uuid.uuid4().hex
    quiz_doc = {
        "quiz_id": quiz_id,
        "user_id": user.user_id,
        "document_id": documents[0]["document_id"],  # primary (BC)
        "document_ids": [d["document_id"] for d in documents],
        "source_titles": [d.get("title") or d.get("filename") for d in documents],
        "recap_id": payload.recap_id,
        "folder_id": payload.folder_id,
        "questions": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quizzes.insert_one(quiz_doc.copy())
    ip = request.client.host if request.client else ""
    await _emit_quiz_status(user.user_id, quiz_id, "processing")
    asyncio.create_task(_bg_generate_quiz(quiz_id, documents, user, payload.question_count, ip, recap_text))
    return _public_quiz(quiz_doc)


@router.get("/quiz/results")
async def quiz_results_list(user: User = Depends(get_current_user), limit: int = 50):
    try:
        results = await db.quiz_results.find(
            {"user_id": user.user_id},
            {"_id": 0, "items": 0},
        ).sort("created_at", -1).to_list(limit)
        
        logger.info(f"User {user.user_id} requested quiz results. Found: {len(results)}")
        
        out = []
        for r in results:
            try:
                quiz_id = r.get("quiz_id")
                if quiz_id:
                    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0, "source_titles": 1, "folder_id": 1})
                    r["source_titles"] = (quiz or {}).get("source_titles", [])
                    r["folder_id"] = (quiz or {}).get("folder_id")
                else:
                    r["source_titles"] = []
                    r["folder_id"] = None
                out.append(r)
            except Exception as e:
                logger.warning(f"Gagal memproses satu item kuis: {e}")
                out.append(r)
                
        return {"results": out}
    except Exception as e:
        logger.exception("Gagal mengambil riwayat kuis")
        raise HTTPException(500, f"Gagal mengambil riwayat: {str(e)}")


@router.get("/quiz/{quiz_id}")
async def quiz_get(quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    return _public_quiz(quiz)


@router.post("/quiz/{quiz_id}/cancel")
async def cancel_quiz(request: Request, quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    if quiz.get("status") != "processing":
        raise HTTPException(400, "Kuis tidak sedang diproses")
    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": {"status": "cancelled"}})
    await write_audit(user.user_id, "QUIZ_CANCELLED", {"quiz_id": quiz_id}, request.client.host if request.client else "")
    await _emit_quiz_status(user.user_id, quiz_id, "cancelled")
    return {"quiz_id": quiz_id, "status": "cancelled"}


@router.put("/quiz/{quiz_id}/progress")
async def save_quiz_progress(quiz_id: str, payload: QuizProgressSave, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0, "questions": 1})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    total = len(quiz.get("questions", []))
    if len(payload.answers) != total:
        raise HTTPException(400, f"Jumlah jawaban ({len(payload.answers)}) tidak sama dengan jumlah soal ({total})")
    if payload.current_step < 0 or payload.current_step >= total:
        raise HTTPException(400, "Langkah tidak valid")
    await db.quizzes.update_one(
        {"quiz_id": quiz_id},
        {"$set": {
            "progress.answers": payload.answers,
            "progress.current_step": payload.current_step,
            "progress.updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"quiz_id": quiz_id, "saved": True}


@router.get("/quiz/{quiz_id}/progress")
async def get_quiz_progress(quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0, "progress": 1})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    return quiz.get("progress") or None


@router.delete("/quiz/{quiz_id}")
async def delete_quiz(request: Request, quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    await db.quiz_results.delete_many({"quiz_id": quiz_id, "user_id": user.user_id})
    await db.quizzes.delete_one({"quiz_id": quiz_id, "user_id": user.user_id})
    await write_audit(user.user_id, "QUIZ_DELETED", {"quiz_id": quiz_id}, request.client.host if request.client else "")
    return {"quiz_id": quiz_id, "deleted": True}


@router.post("/quiz/submit")
async def quiz_submit(request: Request, payload: QuizSubmission, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": payload.quiz_id, "user_id": user.user_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    if quiz.get("status") != "ready":
        raise HTTPException(400, "Kuis belum siap dinilai")

    result_id = uuid.uuid4().hex
    doc = {
        "result_id": result_id,
        "quiz_id": payload.quiz_id,
        "document_id": quiz["document_id"],
        "user_id": user.user_id,
        "answers": payload.answers,
        "score": 0,
        "summary": "",
        "items": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quiz_results.insert_one(doc.copy())
    ip = request.client.host if request.client else ""
    await _emit_result_status(user.user_id, result_id, "processing")
    asyncio.create_task(_bg_grade_quiz(result_id, quiz, payload.answers, user, ip))
    await db.quizzes.update_one({"quiz_id": payload.quiz_id}, {"$unset": {"progress": ""}})
    doc.pop("_id", None)
    return doc


@router.get("/documents/{doc_id}/latest-result")
async def get_latest_doc_result(doc_id: str, user: User = Depends(get_current_user)):
    r = await db.quiz_results.find_one(
        {"document_id": doc_id, "user_id": user.user_id, "status": "ready"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    return r


@router.get("/folders/{folder_id}/latest-result")
async def get_latest_folder_result(folder_id: str, user: User = Depends(get_current_user)):
    quizzes = await db.quizzes.find({"folder_id": folder_id, "user_id": user.user_id}, {"quiz_id": 1}).to_list(100)
    quiz_ids = [q["quiz_id"] for q in quizzes]
    
    if not quiz_ids:
        return None
        
    r = await db.quiz_results.find_one(
        {"quiz_id": {"$in": quiz_ids}, "user_id": user.user_id, "status": "ready"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    return r


@router.get("/quiz/result/{result_id}")
async def quiz_result_get(result_id: str, user: User = Depends(get_current_user)):
    r = await db.quiz_results.find_one({"result_id": result_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Hasil kuis tidak ditemukan")
    quiz = await db.quizzes.find_one({"quiz_id": r.get("quiz_id")}, {"_id": 0})
    if quiz:
        r["source_titles"] = quiz.get("source_titles", [])
        r["questions"] = []
        for i, q in enumerate(quiz.get("questions", [])):
            fb = None
            if r.get("items") and i < len(r["items"]):
                fb = r["items"][i]
            r["questions"].append({
                "question": q.get("question", ""),
                "options": q.get("options", []),
                "correct_index": q.get("correct_index", 0),
                "user_answer_index": r.get("answers", [])[i] if i < len(r.get("answers", [])) else -1,
                "is_correct": fb.get("is_correct") if fb else None,
                "explanation": fb.get("explanation", "") if fb else "",
            })
    return r


@router.post("/quiz/result/{result_id}/chat")
async def quiz_result_chat(result_id: str, payload: QuizChatPayload, user: User = Depends(get_current_user)):
    r = await db.quiz_results.find_one({"result_id": result_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Hasil tidak ditemukan")
    if r.get("status") != "ready":
        raise HTTPException(400, "Hasil belum siap")
    if not payload.question.strip():
        raise HTTPException(400, "Pertanyaan tidak boleh kosong")

    quiz = await db.quizzes.find_one({"quiz_id": r.get("quiz_id")}, {"_id": 0})
    audience = _audience(user)

    summary = (r.get("summary") or "")[:500]
    wrong_questions = []
    correct_count = 0

    if quiz:
        for i, q in enumerate(quiz.get("questions", [])):
            is_correct = True
            if r.get("items") and i < len(r["items"]):
                fb = r["items"][i]
                is_correct = fb.get("is_correct", True)
            if is_correct:
                correct_count += 1
            else:
                fb = r["items"][i] if r.get("items") and i < len(r["items"]) else {}
                wrong_questions.append({
                    "question": (q.get("question", "") or "")[:200],
                    "selected": r.get("answers", [])[i] if i < len(r.get("answers", [])) else -1,
                    "correct": q.get("correct_index", 0),
                    "options": q.get("options", [])[:4],
                    "explanation": (fb.get("explanation", "") or "")[:300],
                    "skill": q.get("skill_type", ""),
                })

    context = {
        "score": r.get("score", 0),
        "summary": summary,
        "total_soal": len(quiz.get("questions", [])) if quiz else 0,
        "benar": correct_count,
        "salah": len(wrong_questions),
        "soal_salah": wrong_questions,
    }

    system = (
        f"Kamu adalah EduScanner AI, tutor akademik untuk {audience}. "
        f"Kamu membantu user memahami hasil kuis mereka. Bahasa Indonesia. "
        f"Gunakan data kuis untuk menjawab. "
        f"Jangan gunakan markdown (** atau ###) dalam jawaban. "
        f"Gunakan teks biasa, tidak perlu format khusus."
    )
    prompt = (
        f"DATA KUIS:\n{json.dumps(context, ensure_ascii=False)}\n\n"
        f"PERTANYAAN USER: {payload.question}"
    )

    try:
        resp = await _call_groq(system, prompt)
        return {"answer": resp}
    except Exception as e:
        raise HTTPException(500, f"Gagal menjawab: {str(e)[:200]}")


@router.post("/quiz/result/{result_id}/cancel")
async def cancel_result(request: Request, result_id: str, user: User = Depends(get_current_user)):
    r = await db.quiz_results.find_one({"result_id": result_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Hasil tidak ditemukan")
    if r.get("status") != "processing":
        raise HTTPException(400, "Hasil tidak sedang diproses")
    await db.quiz_results.update_one({"result_id": result_id}, {"$set": {"status": "cancelled"}})
    await write_audit(user.user_id, "RESULT_CANCELLED", {"result_id": result_id}, request.client.host if request.client else "")
    return {"result_id": result_id, "status": "cancelled"}


@router.delete("/quiz/result/{result_id}")
async def delete_result(request: Request, result_id: str, user: User = Depends(get_current_user)):
    r = await db.quiz_results.find_one({"result_id": result_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Hasil tidak ditemukan")
    await db.quiz_results.delete_one({"result_id": result_id, "user_id": user.user_id})
    await write_audit(user.user_id, "RESULT_DELETED", {"result_id": result_id}, request.client.host if request.client else "")
    return {"result_id": result_id, "deleted": True}
