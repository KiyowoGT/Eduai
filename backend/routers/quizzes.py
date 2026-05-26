import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User, UserRole
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

async def _find_quiz_for_user(quiz_id: str, user: User) -> Optional[dict]:
    # Check private quiz
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    if quiz:
        return quiz
    
    # Check published institutional quiz for student
    if user.role == UserRole.pelajar and user.enrolled_class:
        if user.institution_code:
            quiz = await db.quizzes.find_one({
                "quiz_id": quiz_id,
                "institution_code": user.institution_code,
                "status": "published",
                "$or": [
                    {"class_name": user.enrolled_class},
                    {"target_class_rooms": user.enrolled_class}
                ]
            }, {"_id": 0})
            if quiz:
                return quiz
        elif user.class_token_used:
            token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
            if token_doc:
                quiz = await db.quizzes.find_one({
                    "quiz_id": quiz_id,
                    "user_id": token_doc["created_by_user_id"],
                    "status": "published",
                    "$or": [
                        {"class_name": user.enrolled_class},
                        {"target_class_rooms": user.enrolled_class}
                    ]
                }, {"_id": 0})
                if quiz:
                    return quiz
            
    # For teachers, let's also allow finding any quiz belonging to their institution
    if user.role == UserRole.pengajar and user.institution_code:
        quiz = await db.quizzes.find_one({
            "quiz_id": quiz_id,
            "institution_code": user.institution_code
        }, {"_id": 0})
        if quiz:
            return quiz
            
    return None

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

    # Check for institutional/published documents if not all ids are resolved
    resolved_ids = {d["document_id"] for d in docs}
    missing_ids = [i for i in ids if i not in resolved_ids]
    if missing_ids and user.role == "pelajar":
        if user.institution_code:
            async for d in db.documents.find({
                "document_id": {"$in": missing_ids},
                "institution_code": user.institution_code,
                "visibility": "institution",
                "status": "published"
            }, {"_id": 0, "file_path": 0}):
                docs.append(d)
        elif user.class_token_used:
            token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
            if token_doc:
                async for d in db.documents.find({
                    "document_id": {"$in": missing_ids},
                    "user_id": token_doc["created_by_user_id"],
                    "$or": [
                        {"target_class_room": token_doc["target_class_room"]},
                        {"target_class_rooms": token_doc["target_class_room"]}
                    ],
                    "status": "published"
                }, {"_id": 0, "file_path": 0}):
                    docs.append(d)

    if not docs:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    not_ready = [d.get("filename") for d in docs if d.get("status") not in ("ready", "published")]
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

    # Resolve active academic year id if needed
    academic_year_id = payload.academic_year_id
    if not academic_year_id and user.institution_code:
        active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
        if active_year:
            academic_year_id = active_year.get("academic_year_id")

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
        "curriculum_code": payload.curriculum_code,
        "class_id": payload.class_id,
        "academic_year_id": academic_year_id,
        "institution_code": user.institution_code,
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
                    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0, "source_titles": 1, "folder_id": 1, "institution_code": 1, "subject_name": 1})
                    r["source_titles"] = (quiz or {}).get("source_titles", [])
                    if quiz and (quiz.get("institution_code") or user.class_token_used) and user.role == "pelajar":
                        subj_name = quiz.get("subject_name", "")
                        subj_lower = subj_name.strip().lower()
                        r["folder_id"] = None
                        for s in (user.subjects or []):
                            if s.get("name") and s["name"].strip().lower() == subj_lower:
                                r["folder_id"] = s.get("folder_id")
                                break
                    else:
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


@router.get("/quiz/assigned")
async def quiz_assigned_list(user: User = Depends(get_current_user)):
    if user.role != UserRole.pelajar or not user.enrolled_class:
        return {"quizzes": []}

    query = {
        "status": "published",
        "$or": [
            {"class_name": user.enrolled_class},
            {"target_class_rooms": user.enrolled_class}
        ]
    }
    if user.institution_code:
        query["institution_code"] = user.institution_code
    elif user.class_token_used:
        token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
        if token_doc:
            query["user_id"] = token_doc["created_by_user_id"]
        else:
            return {"quizzes": []}
    else:
        return {"quizzes": []}

    quizzes = await db.quizzes.find(
        query,
        {"_id": 0, "questions": 0}
    ).sort("created_at", -1).to_list(200)

    completed = await db.quiz_results.find(
        {"quiz_id": {"$in": [q["quiz_id"] for q in quizzes]}, "user_id": user.user_id, "status": "ready"},
        {"quiz_id": 1}
    ).to_list(200)
    completed_ids = {r["quiz_id"] for r in completed}

    out = []
    for q in quizzes:
        out.append({
            "quiz_id": q["quiz_id"],
            "title": (q.get("source_titles") or ["Kuis"])[0],
            "subject_name": q.get("subject_name"),
            "deadline": q.get("deadline"),
            "target_classes": q.get("target_class_rooms") or [q.get("class_name")] if q.get("class_name") else [],
            "question_count": len(q.get("questions", [])),
            "created_at": q.get("created_at"),
            "completed": q["quiz_id"] in completed_ids,
        })

    return {"quizzes": out}
async def quiz_get(quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await _find_quiz_for_user(quiz_id, user)
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    out = _public_quiz(quiz)
    
    if quiz.get("institution_code") and user.role == "pelajar":
        subj_name = quiz.get("subject_name", "")
        subj_lower = subj_name.strip().lower()
        for s in (user.subjects or []):
            if s.get("name") and s["name"].strip().lower() == subj_lower:
                out["folder_id"] = s.get("folder_id")
                break
    return out


@router.post("/quiz/{quiz_id}/cancel")
async def cancel_quiz(request: Request, quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await _find_quiz_for_user(quiz_id, user)
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    if quiz.get("status") != "processing":
        raise HTTPException(400, "Kuis tidak sedang diproses")
        
    if quiz.get("institution_code"):
        is_allowed = (
            user.role == "pengajar" and (
                any(t in ("kepala_sekolah", "kurikulum") for t in [ut.value if hasattr(ut, "value") else ut for ut in user.all_titles]) or
                quiz.get("user_id") == user.user_id
            )
        )
        if not is_allowed:
            raise HTTPException(403, "Anda tidak memiliki akses untuk membatalkan kuis ini")
            
    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": {"status": "cancelled"}})
    await write_audit(user.user_id, "QUIZ_CANCELLED", {"quiz_id": quiz_id}, request.client.host if request.client else "")
    await _emit_quiz_status(quiz.get("user_id") or user.user_id, quiz_id, "cancelled")
    return {"quiz_id": quiz_id, "status": "cancelled"}


@router.put("/quiz/{quiz_id}/progress")
async def save_quiz_progress(quiz_id: str, payload: QuizProgressSave, user: User = Depends(get_current_user)):
    quiz = await _find_quiz_for_user(quiz_id, user)
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    total = len(quiz.get("questions", []))
    if len(payload.answers) != total:
        raise HTTPException(400, f"Jumlah jawaban ({len(payload.answers)}) tidak sama dengan jumlah soal ({total})")
    if payload.current_step < 0 or payload.current_step >= total:
        raise HTTPException(400, "Langkah tidak valid")
        
    if quiz.get("institution_code"):
        await db.quiz_progress.update_one(
            {"quiz_id": quiz_id, "user_id": user.user_id},
            {"$set": {
                "answers": payload.answers,
                "current_step": payload.current_step,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True
        )
    else:
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
    quiz = await _find_quiz_for_user(quiz_id, user)
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    if quiz.get("institution_code"):
        prog = await db.quiz_progress.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
        if prog:
            return {
                "answers": prog.get("answers", []),
                "current_step": prog.get("current_step", 0),
                "updated_at": prog.get("updated_at")
            }
        return None
    else:
        return quiz.get("progress") or None


@router.delete("/quiz/{quiz_id}")
async def delete_quiz(request: Request, quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await _find_quiz_for_user(quiz_id, user)
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
        
    if quiz.get("institution_code"):
        is_allowed = (
            user.role == "pengajar" and (
                any(t in ("kepala_sekolah", "kurikulum") for t in [ut.value if hasattr(ut, "value") else ut for ut in user.all_titles]) or 
                quiz.get("user_id") == user.user_id
            )
        )
        if not is_allowed:
            raise HTTPException(403, "Anda tidak memiliki akses untuk menghapus kuis ini")
            
        await db.quiz_progress.delete_many({"quiz_id": quiz_id})
        await db.quiz_results.delete_many({"quiz_id": quiz_id})
        await db.quizzes.delete_one({"quiz_id": quiz_id})
    else:
        await db.quiz_results.delete_many({"quiz_id": quiz_id, "user_id": user.user_id})
        await db.quizzes.delete_one({"quiz_id": quiz_id, "user_id": user.user_id})
        
    await write_audit(user.user_id, "QUIZ_DELETED", {"quiz_id": quiz_id}, request.client.host if request.client else "")
    return {"quiz_id": quiz_id, "deleted": True}


@router.post("/quiz/submit")
async def quiz_submit(request: Request, payload: QuizSubmission, user: User = Depends(get_current_user)):
    quiz = await _find_quiz_for_user(payload.quiz_id, user)
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    if quiz.get("status") not in ("ready", "published"):
        raise HTTPException(400, "Kuis belum siap dinilai")

    result_id = uuid.uuid4().hex
    doc = {
        "result_id": result_id,
        "quiz_id": payload.quiz_id,
        "document_id": quiz.get("document_id"),
        "user_id": user.user_id,
        "created_by": quiz.get("user_id"),
        "answers": payload.answers,
        "score": 0,
        "summary": "",
        "items": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if quiz.get("institution_code"):
        doc["institution_code"] = quiz.get("institution_code")
        doc["student_class"] = user.enrolled_class
        doc["subject_name"] = quiz.get("subject_name")
        doc["academic_year_id"] = quiz.get("academic_year_id") or user.academic_year_id
        doc["source"] = "institution_class"
    elif user.class_token_used:
        doc["student_class"] = user.enrolled_class
        doc["subject_name"] = quiz.get("subject_name")
        doc["source"] = "institution_class"
    else:
        doc["source"] = "personal"
        
    await db.quiz_results.insert_one(doc.copy())
    ip = request.client.host if request.client else ""
    await _emit_result_status(user.user_id, result_id, "processing")
    asyncio.create_task(_bg_grade_quiz(result_id, quiz, payload.answers, user, ip))
    
    if quiz.get("institution_code"):
        await db.quiz_progress.delete_many({"quiz_id": payload.quiz_id, "user_id": user.user_id})
    else:
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
    # 1. Private quizzes
    private_quizzes = await db.quizzes.find({"folder_id": folder_id, "user_id": user.user_id}, {"quiz_id": 1}).to_list(100)
    quiz_ids = [q["quiz_id"] for q in private_quizzes]
    
    # 2. Institutional quizzes
    if user.role == "pelajar" and user.enrolled_class:
        subjects = user.subjects or []
        folder_subj_names = []
        for s in subjects:
            if s.get("folder_id") == folder_id and s.get("name"):
                folder_subj_names.append(s["name"])
        
        folder = await db.folders.find_one({"folder_id": folder_id, "user_id": user.user_id, "status": {"$ne": "deleted"}})
        if folder and folder.get("name") and folder["name"] not in folder_subj_names:
            folder_subj_names.append(folder["name"])
            
        if folder_subj_names:
            if user.institution_code:
                inst_quizzes = await db.quizzes.find({
                    "institution_code": user.institution_code,
                    "class_name": user.enrolled_class,
                    "subject_name": {"$in": folder_subj_names},
                    "status": "published"
                }, {"quiz_id": 1}).to_list(100)
                quiz_ids.extend([q["quiz_id"] for q in inst_quizzes])
            elif user.class_token_used:
                token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
                if token_doc:
                    inst_quizzes = await db.quizzes.find({
                        "user_id": token_doc["created_by_user_id"],
                        "class_name": user.enrolled_class,
                        "subject_name": {"$in": folder_subj_names},
                        "status": "published"
                    }, {"quiz_id": 1}).to_list(100)
                    quiz_ids.extend([q["quiz_id"] for q in inst_quizzes])
            
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
    r = await db.quiz_results.find_one({"result_id": result_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Hasil kuis tidak ditemukan")

    is_owner = r.get("user_id") == user.user_id
    is_teacher_viewer = False

    if not is_owner and user.role == "pengajar":
        quiz = await db.quizzes.find_one({"quiz_id": r.get("quiz_id")}, {"_id": 0})
        if quiz:
            if quiz.get("user_id") == user.user_id:
                is_teacher_viewer = True
            elif TeacherTitle.kepala_sekolah in user.all_titles:
                is_teacher_viewer = True
            elif TeacherTitle.kurikulum in user.all_titles:
                is_teacher_viewer = True
            elif TeacherTitle.guru_kelas in user.all_titles and user.assigned_class:
                student = await db.users.find_one({"user_id": r.get("user_id")}, {"enrolled_class": 1})
                if student and student.get("enrolled_class") == user.assigned_class:
                    is_teacher_viewer = True
            elif TeacherTitle.kajur in user.all_titles:
                quiz_subject = (quiz.get("subject_name") or "").strip().lower()
                user_subject = (user.assigned_subject or "").strip().lower()
                if user_subject and quiz_subject == user_subject:
                    is_teacher_viewer = True
            elif user.assigned_subject:
                quiz_subject = (quiz.get("subject_name") or "").strip().lower()
                user_subject = (user.assigned_subject or "").strip().lower()
                if user_subject and quiz_subject == user_subject:
                    is_teacher_viewer = True

    if not is_owner and not is_teacher_viewer:
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


from deps.auth import require_title

@router.post("/teacher/quizzes/{quiz_id}/approve")
async def approve_quiz(
    quiz_id: str,
    request: Request,
    user: User = Depends(require_title("kurikulum", "kepala_sekolah"))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "institution_code": user.institution_code})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")

    if quiz.get("status") != "pending_approval":
        raise HTTPException(400, f"Kuis tidak dalam status pending_approval (status saat ini: {quiz.get('status')})")

    await db.quizzes.update_one(
        {"quiz_id": quiz_id},
        {"$set": {
            "status": "published",
            "approved_by": user.user_id,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    await write_audit(
        user.user_id,
        "QUIZ_APPROVED",
        {"quiz_id": quiz_id},
        request.client.host if request.client else ""
    )

    return {"status": "published", "quiz_id": quiz_id}

@router.get("/teacher/quizzes/pending-approvals")
async def get_pending_quizzes(
    user: User = Depends(require_title("kurikulum", "kepala_sekolah"))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    quizzes = await db.quizzes.find(
        {"institution_code": user.institution_code, "status": "pending_approval"},
        {"_id": 0}
    ).to_list(100)

    return {"quizzes": quizzes}

