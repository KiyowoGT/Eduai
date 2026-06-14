from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from deps.auth import get_current_user
from models.user import User
from core.database import db
from pydantic import BaseModel
from services.ai_service import ai_service
from core.config import GEMINI_BASE_URL

router = APIRouter(prefix="/system", tags=["System & Support"]) # Prefix ganti ke /system

class BugReport(BaseModel):
    title: str
    severity: str

class AIHelpPayload(BaseModel):
    message: str

@router.post("/report-bug")
async def report_bug(payload: BugReport, user: User = Depends(get_current_user)):
    doc = {
        "title": payload.title,
        "severity": payload.severity,
        "status": "Open",
        "submitted_by": user.email,
        "user_id": user.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.bugs.insert_one(doc)
    return {"status": "ok"}

@router.post("/ai-help")
async def ai_help(payload: AIHelpPayload, user: User = Depends(get_current_user)):
    context = (
        "Kamu adalah Virtual Tutor AI dari platform EduAI (Schooly AI). "
        "Tugasmu adalah membantu user (pelajar/pengajar) dengan pertanyaan "
        "seputar materi pelajaran, fitur aplikasi EduAI, atau masalah teknis ringan. "
        "Jawab dengan ramah, suportif, dan profesional dalam bahasa Indonesia."
    )
    
    response = await ai_service.generate_chat_response(
        messages=[{"role": "user", "content": payload.message}],
        system_prompt=context,
        base_url=GEMINI_BASE_URL # Mengarahkan ke gateway CachyOS
    )
    return {"reply": response}
