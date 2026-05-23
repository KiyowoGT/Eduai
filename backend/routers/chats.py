import re
import json
import uuid
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request

from core.database import db
from core.websocket import realtime_hub
from core.config import BOT_RATE_LIMIT_MAX_MESSAGES, BOT_RATE_LIMIT_WINDOW_SECONDS
from models.user import User
from models.chat import ChatQuestion, SendMessagePayload, DiscussionInvitePayload, DiscussionKickPayload
from deps.auth import get_current_user, _create_notification, _is_blocked_pair
from services.ai_service import _audience, _call_groq, _bg_respond_bot, SANDBOX_PROMPT_TEMPLATE

logger = logging.getLogger(__name__)
router = APIRouter()

_BOT_RATE_LIMIT: dict[tuple[str, str], list[float]] = {}

def _trim_block_times(times: list[float]) -> list[float]:
    cutoff = time.time() - BOT_RATE_LIMIT_WINDOW_SECONDS
    return [t for t in times if t >= cutoff]

def _can_trigger_bot(doc_id: str, user_id: str) -> bool:
    key = (doc_id, user_id)
    times = _trim_block_times(_BOT_RATE_LIMIT.get(key, []))
    if len(times) >= BOT_RATE_LIMIT_MAX_MESSAGES:
        _BOT_RATE_LIMIT[key] = times
        return False
    times.append(time.time())
    _BOT_RATE_LIMIT[key] = times
    return True

async def _can_access_discussion(doc_id: str, user_id: str) -> Optional[dict]:
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user_id}, {"_id": 0})
    if doc:
        return doc
    participant = await db.discussion_participants.find_one(
        {"document_id": doc_id, "user_id": user_id}, {"_id": 0}
    )
    if participant:
        doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
        return doc
    return None

@router.get("/chat/{document_id}")
async def get_chat_messages(document_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": document_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    session_id = f"chat:{user.user_id}:{document_id}"
    session = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0, "messages": 1})
    return {"messages": session.get("messages", []) if session else []}

@router.post("/chat/{document_id}")
async def send_chat_message(document_id: str, payload: ChatQuestion, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": document_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if doc.get("status") != "ready":
        raise HTTPException(400, "Dokumen belum siap")
    if not payload.question.strip():
        raise HTTPException(400, "Pertanyaan tidak boleh kosong")

    session_id = f"chat:{user.user_id}:{document_id}"
    now = datetime.now(timezone.utc).isoformat()

    # Save user message
    user_msg = {"role": "user", "content": payload.question, "created_at": now}
    await db.chat_sessions.update_one(
        {"session_id": session_id},
        {"$setOnInsert": {
            "session_id": session_id,
            "user_id": user.user_id,
            "document_id": document_id,
            "created_at": now,
        }, "$push": {"messages": user_msg}},
        upsert=True,
    )

    audience = _audience(user)

    # Fetch quiz results for context
    quiz_results_list = []
    quizzes = await db.quizzes.find(
        {"document_id": document_id, "user_id": user.user_id},
        {"_id": 0, "quiz_id": 1}
    ).to_list(50)
    quiz_ids = [q["quiz_id"] for q in quizzes]
    if quiz_ids:
        results_cursor = db.quiz_results.find(
            {"quiz_id": {"$in": quiz_ids}, "user_id": user.user_id, "status": "ready"},
            {"_id": 0, "result_id": 1, "score": 1, "created_at": 1, "summary": 1, "quiz_id": 1}
        ).sort("created_at", -1).limit(10)
        quiz_results_list = await results_cursor.to_list(10)

    # Check for @result mention
    mention_text = None
    mention_match = re.search(r'@result:(\S+)', payload.question)
    if mention_match:
        mention_result_id = mention_match.group(1)
        mention_result = await db.quiz_results.find_one(
            {"result_id": mention_result_id, "user_id": user.user_id},
            {"_id": 0}
        )
        if mention_result:
            mention_text = json.dumps({
                "result_id": mention_result_id,
                "score": mention_result.get("score", 0),
                "summary": (mention_result.get("summary") or "")[:500],
                "items": mention_result.get("items", [])[:10],
            }, ensure_ascii=False)

    doc_context = json.dumps({
        "title": doc.get("title", ""),
        "summary": (doc.get("summary") or "")[:1500],
        "key_concepts": [c.get("concept", "") for c in doc.get("key_concepts", [])[:5]],
    }, ensure_ascii=False)

    if user.role == "pelajar" and user.institution_code:
        # Sandbox mode
        system = "Anda adalah AI Mentor EduAI yang disiplin."
        prompt = SANDBOX_PROMPT_TEMPLATE.format(
            student_name=user.name,
            class_name=user.enrolled_class or "Umum",
            referenced_documents_summary=doc_context,
            grade_level=user.education_level or "Sekolah",
            student_question=payload.question
        )
    else:
        system = (
            f"Kamu EduScanner AI, asisten belajar untuk {audience}. "
            f"Kamu membantu user memahami dokumen dan hasil kuis mereka. Bahasa Indonesia. "
            f"Gunakan data dokumen dan riwayat kuis untuk menjawab. "
            f"Jika user menyebut @result:ID, lihat detail kuis tersebut. "
            f"Jangan gunakan markdown (** atau ###) dalam jawaban."
        )

        results_summary = []
        for r in quiz_results_list[:5]:
            score = r.get("score", 0)
            date_str = (r.get("created_at") or "")[:10]
            rid = r.get("result_id", "")
            results_summary.append(f"- {date_str} | Skor: {score}/100 | Sebut: @result:{rid}")

        quiz_context = ""
        if results_summary:
            quiz_context = "\nRIWAYAT KUIS:\n" + "\n".join(results_summary)
        if mention_text:
            quiz_context += f"\n\nDETAIL KUIS YANG DISEBUT:\n{mention_text}"

        prompt = (
            f"DOKUMEN:\n{doc_context}\n"
            f"{quiz_context}\n\n"
            f"PERTANYAAN: {payload.question}"
        )

    try:
        resp = await _call_groq(system, prompt)
    except Exception as e:
        raise HTTPException(500, f"Gagal menjawab: {str(e)[:200]}")

    # Save AI response
    ai_msg = {"role": "ai", "content": resp, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.chat_sessions.update_one(
        {"session_id": session_id},
        {"$push": {"messages": ai_msg}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"answer": resp}

@router.delete("/chat/{document_id}")
async def clear_chat_messages(document_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": document_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    session_id = f"chat:{user.user_id}:{document_id}"
    await db.chat_sessions.delete_one({"session_id": session_id})
    return {"cleared": True}

@router.get("/chat/{document_id}/quiz-results")
async def get_document_quiz_results(document_id: str, user: User = Depends(get_current_user)):
    quizzes = await db.quizzes.find(
        {"document_id": document_id, "user_id": user.user_id},
        {"_id": 0, "quiz_id": 1}
    ).to_list(50)
    quiz_ids = [q["quiz_id"] for q in quizzes]
    if not quiz_ids:
        return {"results": []}
    results_cursor = db.quiz_results.find(
        {"quiz_id": {"$in": quiz_ids}, "user_id": user.user_id, "status": "ready"},
        {"_id": 0, "result_id": 1, "score": 1, "created_at": 1}
    ).sort("created_at", -1).limit(20)
    results = await results_cursor.to_list(20)
    return {"results": results}

@router.get("/documents/{doc_id}/messages")
async def list_discussion_messages(doc_id: str, user: User = Depends(get_current_user), limit: int = 50, before: Optional[str] = None):
    doc = await _can_access_discussion(doc_id, user.user_id)
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    query = {"document_id": doc_id}
    if before:
        query["created_at"] = {"$lt": before}
    messages = await db.discussion_messages.find(
        query, {"_id": 0},
    ).sort("created_at", -1).to_list(limit)
    messages.reverse()
    return {"messages": messages, "document": {"title": doc.get("title", ""), "filename": doc.get("filename", "")}, "has_more": len(messages) >= limit}

@router.post("/documents/{doc_id}/messages")
async def send_discussion_message(doc_id: str, payload: SendMessagePayload, user: User = Depends(get_current_user)):
    doc = await _can_access_discussion(doc_id, user.user_id)
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if not payload.content.strip():
        raise HTTPException(400, "Pesan tidak boleh kosong")

    content = payload.content.strip()
    msg_id = uuid.uuid4().hex
    msg = {
        "message_id": msg_id,
        "document_id": doc_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "user_picture": user.picture,
        "content": content,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.discussion_messages.insert_one(msg)

    # Notify participants
    participant_ids = set()
    participant_ids.add(doc.get("user_id", user.user_id))
    async for p in db.discussion_participants.find({"document_id": doc_id}, {"_id": 0, "user_id": 1}):
        participant_ids.add(p["user_id"])
    for pid in participant_ids:
        if pid != user.user_id and pid != "bot":
            doc_title = doc.get("title") or doc.get("filename") or "dokumen"
            await _create_notification(
                pid, "discussion_message",
                f"{user.name} mengirim pesan di diskusi {doc_title}",
                {"document_id": doc_id, "document_title": doc_title},
            )
        if pid != "bot":
            await realtime_hub.broadcast(pid, {"type": "discussion_message", "document_id": doc_id, "message": msg})

    # @bot trigger
    if "@bot" in content.lower() and doc and doc.get("status") == "ready":
        if not _can_trigger_bot(doc_id, user.user_id):
            raise HTTPException(429, f"Batas @bot {BOT_RATE_LIMIT_MAX_MESSAGES} pesan per {BOT_RATE_LIMIT_WINDOW_SECONDS} detik")
        try:
            audience = _audience(user)
            question = content.lower().replace("@bot", "").strip()
            if not question:
                question = "Jelaskan materi ini secara singkat"
            asyncio.create_task(_bg_respond_bot(doc_id, question, doc, audience, doc.get("user_id", ""), user=user))
        except Exception as e:
            logger.exception(f"Bot trigger gagal: {e}")

    return msg

@router.post("/documents/{doc_id}/discussion/invite")
async def invite_to_discussion(doc_id: str, payload: DiscussionInvitePayload, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if not payload.user_ids:
        raise HTTPException(400, "Pilih minimal satu teman")

    invited = []
    for target_id in payload.user_ids:
        if await _is_blocked_pair(user.user_id, target_id):
            continue
        accepted = await db.friend_requests.find_one({
            "status": "accepted",
            "$or": [
                {"from_user_id": user.user_id, "to_user_id": target_id},
                {"from_user_id": target_id, "to_user_id": user.user_id},
            ]
        }, {"_id": 0, "friend_request_id": 1})
        if not accepted:
            continue
        existing = await db.discussion_participants.find_one(
            {"document_id": doc_id, "user_id": target_id}, {"_id": 0}
        )
        if existing:
            continue
        friend = await db.users.find_one({"user_id": target_id}, {"_id": 0, "name": 1})
        if not friend:
            continue
        await db.discussion_participants.insert_one({
            "document_id": doc_id,
            "user_id": target_id,
            "invited_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        invited.append(target_id)
        doc_title = doc.get("title") or doc.get("filename") or "dokumen"
        await _create_notification(
            target_id, "discussion_invite",
            f"{user.name} mengundangmu ke diskusi {doc_title}",
            {"document_id": doc_id, "document_title": doc_title, "invited_by": user.user_id},
        )

    return {"invited": invited, "count": len(invited)}

@router.get("/documents/{doc_id}/discussion/participants")
async def list_discussion_participants(doc_id: str, user: User = Depends(get_current_user)):
    doc = await _can_access_discussion(doc_id, user.user_id)
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")

    participants = []
    owner = await db.users.find_one({"user_id": doc.get("user_id")}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "friend_code": 1})
    if owner:
        participants.append({**owner, "role": "owner"})

    async for p in db.discussion_participants.find({"document_id": doc_id}, {"_id": 0}):
        u = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "friend_code": 1})
        if u:
            participants.append({**u, "role": "member"})

    return {"participants": participants}

@router.post("/documents/{doc_id}/discussion/kick")
async def kick_from_discussion(doc_id: str, payload: DiscussionKickPayload, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Hanya pemilik dokumen yang bisa mengeluarkan peserta")
    if payload.user_id == user.user_id:
        raise HTTPException(400, "Tidak bisa mengeluarkan diri sendiri")

    result = await db.discussion_participants.delete_one(
        {"document_id": doc_id, "user_id": payload.user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Peserta tidak ditemukan")

    target = await db.users.find_one({"user_id": payload.user_id}, {"_id": 0, "name": 1})
    if target:
        doc_title = doc.get("title") or doc.get("filename") or "dokumen"
        await _create_notification(
            payload.user_id, "discussion_kicked",
            f"Kamu dikeluarkan dari diskusi {doc_title} oleh {user.name}",
            {"document_id": doc_id, "document_title": doc_title},
        )

    return {"ok": True}

@router.post("/documents/{doc_id}/discussion/leave")
async def leave_discussion(doc_id: str, user: User = Depends(get_current_user)):
    result = await db.discussion_participants.delete_one(
        {"document_id": doc_id, "user_id": user.user_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Kamu bukan peserta diskusi ini")
    return {"ok": True}

@router.post("/documents/{doc_id}/chat")
async def chat_with_document(doc_id: str, payload: ChatQuestion, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if doc.get("status") != "ready":
        raise HTTPException(400, "Dokumen belum siap dianalisis")
    if not payload.question.strip():
        raise HTTPException(400, "Pertanyaan tidak boleh kosong")

    audience = _audience(user)
    # Token Optimization: Budget sangat ketat untuk fitur chat
    context = json.dumps({
        "title": doc.get("title", ""),
        "summary": (doc.get("summary") or "")[:2500],
        "key_concepts": [c.get("concept", "") for c in doc.get("key_concepts", [])[:5]],
        "learning_objectives": doc.get("learning_objectives", [])[:4],
    }, ensure_ascii=False)

    if user.role == "pelajar" and user.institution_code:
        # Sandbox mode
        system = "Anda adalah AI Mentor EduAI yang disiplin."
        prompt = SANDBOX_PROMPT_TEMPLATE.format(
            student_name=user.name,
            class_name=user.enrolled_class or "Umum",
            referenced_documents_summary=context,
            grade_level=user.education_level or "Sekolah",
            student_question=payload.question
        )
    else:
        system = (
            f"Kamu EduScanner AI, asisten belajar untuk {audience}. "
            f"Jawab pertanyaan berdasarkan dokumen. Bahasa Indonesia."
        )
        prompt = (
            f"DOKUMEN:\n{context}\n\n"
            f"PERTANYAAN: {payload.question}"
        )

    try:
        resp = await _call_groq(system, prompt)
        return {"answer": resp}
    except Exception as e:
        # Fallback: prompt sangat minimal jika 413
        try:
            resp = await _call_groq(system, f"Materi: {doc.get('title')}. Tanya: {payload.question}")
            return {"answer": resp}
        except:
            raise HTTPException(500, f"Gagal menjawab: {str(e)[:100]}")
