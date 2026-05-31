import uuid
import asyncio
from datetime import datetime, timezone
from typing import List
from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, Request

from core.database import db
from core.config import AUDIO_DIR, API_PREFIX
from models.user import User
from models.recap import RecapRequest
from deps.auth import get_current_user, write_audit
from services.ai_service import _bg_generate_recap, _emit_recap_status
from services.kafka_jobs import enqueue_recap_generate
from services.tts_service import _generate_tts
from routers.quizzes import _resolve_documents

router = APIRouter()

@router.post("/recap")
async def recap_generate(request: Request, payload: RecapRequest, user: User = Depends(get_current_user)):
    documents = await _resolve_documents(None, payload.document_ids, payload.folder_id, user)
    recap_id = uuid.uuid4().hex
    doc = {
        "recap_id": recap_id,
        "user_id": user.user_id,
        "document_ids": [d["document_id"] for d in documents],
        "source_titles": [d.get("title") or d.get("filename") for d in documents],
        "folder_id": payload.folder_id,
        "title": "",
        "unified_summary": "",
        "per_document": [],
        "shared_concepts": [],
        "study_path": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.recaps.insert_one(doc.copy())
    ip = request.client.host if request.client else ""
    await _emit_recap_status(user.user_id, recap_id, "processing")
    if not await enqueue_recap_generate(recap_id, documents, user, ip):
        asyncio.create_task(_bg_generate_recap(recap_id, documents, user, ip))
    doc.pop("_id", None)
    return doc


@router.get("/recap/{recap_id}")
async def recap_get(recap_id: str, user: User = Depends(get_current_user)):
    r = await db.recaps.find_one({"recap_id": recap_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Recap tidak ditemukan")
    return r


@router.post("/recap/{recap_id}/cancel")
async def recap_cancel(request: Request, recap_id: str, user: User = Depends(get_current_user)):
    r = await db.recaps.find_one({"recap_id": recap_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Recap tidak ditemukan")
    if r.get("status") != "processing":
        raise HTTPException(400, "Recap tidak sedang diproses")
    await db.recaps.update_one({"recap_id": recap_id}, {"$set": {"status": "cancelled"}})
    await write_audit(user.user_id, "RECAP_CANCELLED", {"recap_id": recap_id}, request.client.host if request.client else "")
    await _emit_recap_status(user.user_id, recap_id, "cancelled")
    return {"recap_id": recap_id, "status": "cancelled"}


@router.delete("/recap/{recap_id}")
async def recap_delete(request: Request, recap_id: str, user: User = Depends(get_current_user)):
    r = await db.recaps.find_one({"recap_id": recap_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Recap tidak ditemukan")
    await db.recaps.delete_one({"recap_id": recap_id, "user_id": user.user_id})
    if r.get("folder_id"):
        await db.folders.update_one(
            {"folder_id": r["folder_id"]},
            {"$unset": {
                "recap_id": "",
                "recap_title": "",
                "recap_summary": "",
                "recap_document_ids": "",
                "recap_generated_at": "",
            }}
        )
    await write_audit(user.user_id, "RECAP_DELETED", {"recap_id": recap_id}, request.client.host if request.client else "")
    return {"recap_id": recap_id, "deleted": True}


@router.get("/recaps")
async def recap_list(user: User = Depends(get_current_user)):
    recaps = await db.recaps.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return recaps


@router.post("/recap/{recap_id}/tts")
async def recap_tts(recap_id: str, user: User = Depends(get_current_user)):
    recap = await db.recaps.find_one({"recap_id": recap_id, "user_id": user.user_id}, {"_id": 0})
    if not recap:
        raise HTTPException(404, "Recap tidak ditemukan")
    text = (recap.get("unified_summary") or "").strip()
    if not text:
        raise HTTPException(400, "Recap belum memiliki konten ringkasan")

    audio_filename = f"recap_{recap_id}.wav"
    audio_path = AUDIO_DIR / audio_filename

    if not audio_path.exists():
        await _generate_tts(text, str(audio_path), user)

    existing = await db.audio_files.find_one({"filename": audio_filename}, {"_id": 1})
    if not existing and audio_path.exists():
        with open(audio_path, "rb") as f:
            data = f.read()
        await db.audio_files.update_one(
            {"filename": audio_filename},
            {"$set": {
                "filename": audio_filename,
                "data": Binary(data),
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )

    audio_url = f"{API_PREFIX}/audio/{audio_filename}"
    await db.recaps.update_one(
        {"recap_id": recap_id},
        {"$set": {"audio_url": audio_url}},
    )
    return {"audio_url": audio_url, "status": "ready"}
