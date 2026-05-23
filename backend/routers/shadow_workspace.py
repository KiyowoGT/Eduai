import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User
from deps.auth import get_current_user, write_audit

logger = logging.getLogger(__name__)
router = APIRouter()

class ShadowRedeemPayload(BaseModel):
    redeem_code: str

@router.post("/shadow-workspace/redeem")
async def shadow_redeem(payload: ShadowRedeemPayload, request: Request, user: User = Depends(get_current_user)):
    code = payload.redeem_code.strip().upper()
    if not code:
        raise HTTPException(400, "Kode redeem wajib diisi")

    # In a real scenario, we would validate this code against a SaaS service or a codes collection
    # For now, let's assume any code starting with 'SAAS-' is valid for demo/implementation purposes
    if not code.startswith("SAAS-"):
        raise HTTPException(400, "Kode redeem tidak valid atau bukan untuk layanan SaaS")

    # Check if already redeemed by this user
    existing = await db.shadow_workspace_sessions.find_one({"redeem_code": code, "user_id": user.user_id})
    if existing:
        raise HTTPException(400, "Kode ini sudah Anda gunakan")

    # Mock SaaS data
    session_id = uuid.uuid4().hex
    session_doc = {
        "session_id": session_id,
        "user_id": user.user_id,
        "redeem_code": code,
        "source": "saas_redeem",
        "service_provider": "EduAI Private Tutor",
        "subject_name": "Belajar Mandiri",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.shadow_workspace_sessions.insert_one(session_doc)
    await write_audit(user.user_id, "SHADOW_WORKSPACE_REDEEM", {"code": code, "session_id": session_id}, request.client.host if request.client else "")
    
    return {"session_id": session_id, "message": "Kode berhasil di-redeem. Selamat belajar mandiri!"}

@router.get("/shadow-workspace/activities")
async def list_shadow_activities(user: User = Depends(get_current_user)):
    activities = await db.shadow_workspace_sessions.find({"user_id": user.user_id}).sort("created_at", -1).to_list(50)
    
    # Also include quiz results from shadow workspace
    quiz_results = await db.quiz_results.find({"user_id": user.user_id, "source": "saas_redeem"}).sort("created_at", -1).to_list(50)
    
    for q in quiz_results:
        q["activity_type"] = "quiz_result"
        q["label"] = "Aktivitas Mandiri (Privat)"
        
    for a in activities:
        a["activity_type"] = "redeem_session"
        a["label"] = "Sesi Belajar Mandiri"

    all_activities = activities + quiz_results
    all_activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {"activities": all_activities[:50]}
