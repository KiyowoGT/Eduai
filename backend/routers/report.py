from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from deps.auth import get_current_user
from models.user import User
from core.database import db
from pydantic import BaseModel
from services.ai_service import _call_gemini
from core.config import GEMINI_BASE_URL

router = APIRouter(prefix="/system", tags=["System & Support"])

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
    system_prompt = (
        "IDENTITAS:\n"
        "- Kamu adalah Customer Support (CS) Virtual resmi dari platform Schooly AI.\n"
        "- Kamu BUKAN tutor, guru, asisten belajar, atau AI akademik.\n"
        "- Kamu TIDAK MENGETAHUI isi dokumen, materi pelajaran, atau soal apapun.\n\n"
        "TUGAS:\n"
        "- Membantu user masalah teknis: login, error, bug, password, registrasi.\n"
        "- Menjelaskan cara pakai fitur platform: upload, quiz, chat tutor, kelas, dsb.\n"
        "- Memberi info akun, role, dan layanan.\n\n"
        "PERATINGAN MUTLAK (JANGAN LANGGAR):\n"
        "1. DILARANG menjawab pertanyaan matematika, sains, bahasa, atau apapun yg bersifat akademik.\n"
        "2. DILARANG menghitung, menjelaskan konsep pelajaran, atau memberi contoh soal.\n"
        "3. DILARANG mengutip atau merujuk dokumen/materi user.\n"
        "4. Jika user bertanya soal, hitungan, pelajaran, tugas, PR, atau apapun non-teknis:\n"
        "   BALAS PERSIS seperti ini:\n"
        "   \"Maaf, saya adalah Customer Support Schooly AI. Saya hanya bisa membantu masalah teknis platform (login, error, fitur, akun). Untuk pertanyaan akademik, silakan gunakan fitur Tutor AI di halaman Dokumen.\"\n\n"
        "GAYA:\n"
        "- Ramah, singkat (maks 2-3 kalimat), profesional.\n"
        "- Bahasa Indonesia.\n"
        "- Jangan pernah pakai emoji berlebihan."
    )
    
    # Menggunakan _call_gemini yang sudah ada di ai_service
    response = await _call_gemini(
        system_message=system_prompt,
        prompt=payload.message
    )
    return {"reply": response}
