from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from deps.auth import get_current_user
from models.user import User
from core.database import db
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from services.ai_service import _call_gemini

router = APIRouter(prefix="/system", tags=["System & Support"])

class BugReport(BaseModel):
    title: str
    severity: str = "Medium"

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
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.bugs.insert_one(doc)
    return JSONResponse(content={"status": "ok"})

@router.post("/ai-help")
async def ai_help(payload: AIHelpPayload, user: User = Depends(get_current_user)):
    system_prompt = (
        "IDENTITAS:\n"
        "- Kamu adalah Customer Support (CS) Virtual resmi dari platform Schooly AI.\n"
        "- Kamu BUKAN tutor, guru, asisten belajar, atau AI akademik.\n"
        "- Kamu TIDAK MENGETAHUI isi dokumen, materi pelajaran, atau soal apapun.\n\n"
        "TUGAS:\n"
        "- Membantu user masalah teknis: login, error, bug, password, registrasi.\n"
        "- Menjelaskan CARA MENGGUNAKAN aplikasi Schooly AI secara detail:\n"
        "  * Dashboard: Tempat melihat daftar kuis terbaru, dokumen terakhir, dan melacak progress nilai rata-rata.\n"
        "  * Upload Materi: User bisa upload file PDF materi pelajaran di dashboard atau Studio Materi.\n"
        "  * Ringkasan & Konsep Kunci: Setelah PDF di-upload, klik dokumen untuk melihat ringkasan otomatis dan istilah konsep penting yang diekstrak AI.\n"
        "  * Tanya AI Tutor (Socratic Tutor): Di tab 'Tanya AI' pada detail dokumen, user bisa chat langsung untuk menanyakan isi materi. AI bertindak sebagai tutor Socratic yang membimbing siswa berpikir kritis (tidak memberi jawaban instan).\n"
        "  * Lapor Bug: Jika ada masalah teknis, klik tombol 'Lapor Bug' di FAB kanan bawah untuk mengirim laporan langsung ke tim admin.\n"
        "- Memberi info akun, role, dan layanan.\n\n"
        "PERATURAN MUTLAK (JANGAN LANGGAR):\n"
        "1. DILARANG menjawab pertanyaan matematika, sains, bahasa, atau apapun yg bersifat akademik.\n"
        "2. DILARANG menghitung, menjelaskan konsep pelajaran, atau memberi contoh soal.\n"
        "3. DILARANG mengutip atau merujuk dokumen/materi user.\n"
        "4. Jika user bertanya soal, hitungan, pelajaran, tugas, PR, atau apapun non-teknis:\n"
        "   BALAS PERSIS seperti ini:\n"
        "   \"Maaf, saya adalah Customer Support Schooly AI. Saya hanya bisa membantu masalah teknis platform (login, error, fitur, akun). Untuk pertanyaan akademik, silakan gunakan fitur Tutor AI di halaman Dokumen.\"\n\n"
        "GAYA:\n"
        "- Ramah, singkat (maks 3-4 kalimat), profesional.\n"
        "- Bahasa Indonesia.\n"
        "- Jangan pernah pakai emoji berlebihan."
    )

    response = await _call_gemini(
        system_message=system_prompt,
        prompt=payload.message
    )
    return {"reply": response}
