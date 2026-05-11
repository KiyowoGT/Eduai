"""EduScanner AI - University Edition - FastAPI Backend"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import uuid
import shutil
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta

import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
GEMINI_MODEL = "gemini-3.1-pro-preview"        # for PDF analysis (needs file attachment)
GEMINI_FAST_MODEL = "gemini-3-flash-preview"   # for quiz gen + feedback (text only, faster)
GEMINI_FALLBACK = "gemini-2.5-pro"

app = FastAPI(title="EduScanner AI")
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# ============== Models ==============
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    education_level: Optional[str] = None  # SD, SMP, SMA, SMK, MA, Universitas
    major: Optional[str] = None            # jurusan / prodi (kosong untuk SD/SMP)
    institution: Optional[str] = None      # nama sekolah / universitas
    current_semester: Optional[int] = None # kelas/tingkat untuk sekolah, semester untuk univ
    onboarded: bool = False
    created_at: datetime

class ProfileUpdate(BaseModel):
    education_level: str
    major: Optional[str] = None
    institution: str
    current_semester: int

class DocumentMeta(BaseModel):
    document_id: str
    user_id: str
    filename: str
    title: Optional[str] = None
    summary: Optional[str] = None
    key_concepts: List[dict] = []
    diagrams: List[dict] = []
    learning_objectives: List[str] = []
    status: str = "processing"
    created_at: datetime

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    skill_type: str  # analisis_kode, troubleshooting, perancangan_db, konsep

class Quiz(BaseModel):
    quiz_id: str
    user_id: str
    document_id: str
    questions: List[QuizQuestion]
    created_at: datetime

class QuizGenerateRequest(BaseModel):
    document_id: str
    question_count: int = 5

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: List[int]  # selected option indexes

class FeedbackItem(BaseModel):
    question: str
    selected: str
    correct: str
    is_correct: bool
    explanation: str
    references: List[str]

# ============== Auth helpers ==============
async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
    if not token:
        raise HTTPException(401, "Tidak terautentikasi")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Sesi tidak valid")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Sesi kadaluarsa")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(401, "User tidak ditemukan")
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    return User(**user_doc)


async def write_audit(user_id: str, action: str, details: dict = None, ip: str = ""):
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    counter = await db.counters.find_one_and_update(
        {"_id": f"audit_{today}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    log_id = f"AUD-{today}-{seq:04d}"
    doc = {
        "log_id": log_id,
        "user_id": user_id,
        "action": action,
        "details": details or {},
        "ip_address": ip,
        "audit_date": today,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_logs.insert_one(doc)
    return log_id


# ============== Auth Endpoints ==============
@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id wajib ada")

    async with httpx.AsyncClient(timeout=15.0) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Gagal verifikasi sesi Google")
    data = r.json()

    email = data["email"]
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        user_id = user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "onboarded": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await write_audit(user_id, "LOGIN_SUCCESS", {"email": email}, request.client.host if request.client else "")

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc}


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============== Profile ==============
@api_router.put("/profile")
async def update_profile(payload: ProfileUpdate, request: Request, user: User = Depends(get_current_user)):
    LEVELS_NO_MAJOR = {"SD", "SMP"}
    major = payload.major if payload.education_level not in LEVELS_NO_MAJOR else None
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "education_level": payload.education_level,
            "major": major,
            "institution": payload.institution,
            "current_semester": payload.current_semester,
            "onboarded": True,
        }},
    )
    await write_audit(user.user_id, "PROFILE_UPDATE", payload.model_dump(), request.client.host if request.client else "")
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return user_doc


# ============== AI helpers ==============
def _llm_chat(session_id: str, system_message: str, fast: bool = False) -> LlmChat:
    model = GEMINI_FAST_MODEL if fast else GEMINI_MODEL
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("gemini", model)


def _parse_json_block(text: str) -> Any:
    text = text.strip()
    # remove markdown fences
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if m:
        text = m.group(1).strip()
    # Best-effort: trim anything before first {/[ or after last }/]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = min((i for i in [text.find("{"), text.find("[")] if i != -1), default=-1)
        end = max(text.rfind("}"), text.rfind("]"))
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end+1])
        raise


def _audience(user: User) -> str:
    level = user.education_level or "Umum"
    major = user.major or ("Umum" if level in {"SD", "SMP"} else "Umum")
    sem = user.current_semester
    if level in {"SD", "SMP", "SMA", "SMK", "MA"}:
        sem_label = f"kelas {sem}" if sem else ""
        return f"siswa {level} {sem_label} jurusan/peminatan {major}".strip()
    return f"mahasiswa {level} semester {sem or '-'} prodi {major}"


async def analyze_pdf(file_path: str, user: User) -> dict:
    audience = _audience(user)
    system = (
        f"Kamu adalah EduScanner AI, asisten akademik untuk pelajar/mahasiswa Indonesia. "
        f"Target user: {user.name} — {audience}. "
        f"Sesuaikan tingkat kedalaman & gaya bahasa dengan jenjang user (lebih sederhana untuk SD/SMP, "
        f"lebih teknis untuk SMK/Universitas). Selalu bahasa Indonesia. "
        f"Jika ada diagram teknis (Sequence/Class/ERD/Flowchart), jelaskan alur logic-nya. "
        f"Untuk jurusan teknis (RPL/TKJ/Informatika), hubungkan teori ke contoh kode implementasi."
    )
    chat = _llm_chat(f"doc-{uuid.uuid4().hex[:8]}", system)
    prompt = (
        "Analisis PDF terlampir. Kembalikan SATU objek JSON saja (tanpa pembungkus markdown) dengan struktur:\n"
        '{\n'
        '  "title": "judul dokumen",\n'
        '  "summary": "ringkasan abstraksi, metodologi, hasil (3-5 paragraf, bahasa Indonesia akademik)",\n'
        '  "key_concepts": [{"concept": "...", "explanation": "...", "code_example": "opsional, isi kode jika prodi Informatika"}],\n'
        '  "diagrams": [{"name": "...", "type": "Sequence/Class/ERD/Flowchart", "explanation": "..."}],\n'
        '  "learning_objectives": ["tujuan belajar 1", "tujuan 2", ...]\n'
        '}\n'
        "Minimal 5 key_concepts, 3 learning_objectives. Jika tidak ada diagram, kembalikan array kosong."
    )
    file_obj = FileContentWithMimeType(file_path=file_path, mime_type="application/pdf")
    msg = UserMessage(text=prompt, file_contents=[file_obj])
    try:
        resp = await chat.send_message(msg)
    except Exception as e:
        logger.error(f"Gemini 3 Pro failed, fallback to 2.5: {e}")
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"doc-fb-{uuid.uuid4().hex[:8]}", system_message=system).with_model("gemini", GEMINI_FALLBACK)
        resp = await chat.send_message(msg)
    data = _parse_json_block(resp)
    return data


async def generate_quiz_questions(document: dict, user: User, n: int = 5) -> List[dict]:
    audience = _audience(user)
    system = (
        f"Kamu adalah EduScanner AI, generator soal kuis HOTS (High Order Thinking Skills) bahasa Indonesia "
        f"untuk {audience}. Soal harus menguji analisis, evaluasi, dan kreativitas — bukan hafalan. "
        f"Sesuaikan tingkat kesulitan dengan jenjang. Untuk RPL/TKJ/Informatika sertakan soal "
        f"analisis kode/troubleshooting/perancangan database bila relevan."
    )
    chat = _llm_chat(f"quiz-{uuid.uuid4().hex[:8]}", system, fast=True)
    context = json.dumps({
        "title": document.get("title"),
        "summary": document.get("summary"),
        "key_concepts": document.get("key_concepts", []),
        "learning_objectives": document.get("learning_objectives", []),
    }, ensure_ascii=False)[:8000]
    prompt = (
        f"Berdasarkan materi berikut, buat {n} soal pilihan ganda HOTS. "
        f"Setiap soal punya 4 opsi (A-D), satu jawaban benar.\n\nMATERI:\n{context}\n\n"
        "Kembalikan JSON array saja, tanpa markdown:\n"
        '[{"question": "...", "options": ["...","...","...","..."], "correct_index": 0, "skill_type": "analisis_kode|troubleshooting|perancangan_db|konsep"}]'
    )
    resp = await chat.send_message(UserMessage(text=prompt))
    data = _parse_json_block(resp)
    out = []
    for q in data[:n]:
        out.append({
            "id": uuid.uuid4().hex[:8],
            "question": q["question"],
            "options": q["options"][:4],
            "correct_index": int(q["correct_index"]),
            "skill_type": q.get("skill_type", "konsep"),
        })
    return out


async def generate_deep_feedback(quiz: dict, answers: List[int], user: User) -> dict:
    audience = _audience(user)
    items = []
    for i, q in enumerate(quiz["questions"]):
        sel = answers[i] if i < len(answers) else -1
        items.append({
            "question": q["question"],
            "options": q["options"],
            "correct_index": q["correct_index"],
            "selected_index": sel,
        })
    system = (
        f"Kamu EduScanner AI memberi feedback akademik mendalam bahasa Indonesia untuk {audience}. "
        f"Selalu sertakan minimal satu referensi akademik, buku pelajaran, atau standar industri yang relevan "
        f"(misal untuk univ: 'Menurut Pressman (Software Engineering, 2014)...'; untuk SMA/SMK: 'Sesuai buku "
        f"paket Kurikulum Merdeka...', 'Modul Kemendikbud...'). Sesuaikan gaya bahasa dengan jenjang."
    )
    chat = _llm_chat(f"fb-{uuid.uuid4().hex[:8]}", system, fast=True)
    prompt = (
        "Berikan feedback per soal. Kembalikan JSON saja tanpa markdown.\n\n"
        f"SOAL+JAWABAN: {json.dumps(items, ensure_ascii=False)}\n\n"
        "Format:\n"
        '{\n'
        '  "score": 0-100,\n'
        '  "summary": "ringkasan performa & saran perbaikan",\n'
        '  "items": [{"question":"...","selected":"...","correct":"...","is_correct":true,"explanation":"...","references":["...","..."]}]\n'
        '}'
    )
    resp = await chat.send_message(UserMessage(text=prompt))
    return _parse_json_block(resp)


# ============== Documents ==============
async def _bg_analyze_document(doc_id: str, file_path: str, user: User, ip: str):
    try:
        analysis = await analyze_pdf(file_path, user)
        update = {
            "title": analysis.get("title") or "",
            "summary": analysis.get("summary", ""),
            "key_concepts": analysis.get("key_concepts", []),
            "diagrams": analysis.get("diagrams", []),
            "learning_objectives": analysis.get("learning_objectives", []),
            "status": "ready",
        }
        await db.documents.update_one({"document_id": doc_id}, {"$set": update})
        await write_audit(user.user_id, "DOCUMENT_ANALYZED", {"document_id": doc_id}, ip)
    except Exception as e:
        logger.exception("Background analyze gagal")
        await db.documents.update_one(
            {"document_id": doc_id},
            {"$set": {"status": "failed", "error": str(e)[:300]}},
        )
        await write_audit(user.user_id, "DOCUMENT_ANALYSIS_FAILED", {"document_id": doc_id, "error": str(e)[:300]}, ip)


@api_router.post("/documents/upload")
async def upload_document(request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Format tidak didukung. Hanya PDF yang diterima.")

    doc_id = uuid.uuid4().hex
    saved_path = UPLOAD_DIR / f"{doc_id}.pdf"
    with saved_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    base = {
        "document_id": doc_id,
        "user_id": user.user_id,
        "filename": file.filename,
        "title": file.filename,
        "file_path": str(saved_path),
        "summary": "",
        "key_concepts": [],
        "diagrams": [],
        "learning_objectives": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(base.copy())
    ip = request.client.host if request.client else ""
    await write_audit(user.user_id, "DOCUMENT_UPLOAD", {"document_id": doc_id, "filename": file.filename}, ip)

    # Kick off background analysis — returns immediately
    asyncio.create_task(_bg_analyze_document(doc_id, str(saved_path), user, ip))

    doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
    return doc


@api_router.get("/documents")
async def list_documents(user: User = Depends(get_current_user)):
    docs = await db.documents.find({"user_id": user.user_id}, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(100)
    return docs


@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0, "file_path": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    return doc


# ============== Quiz ==============
def _public_quiz(quiz_doc: dict) -> dict:
    out = {k: v for k, v in quiz_doc.items() if k != "_id"}
    if isinstance(out.get("questions"), list):
        out["questions"] = [{k: v for k, v in q.items() if k != "correct_index"} for q in out["questions"]]
    return out


async def _bg_generate_quiz(quiz_id: str, doc: dict, user: User, n: int, ip: str):
    try:
        questions = await generate_quiz_questions(doc, user, n=n)
        await db.quizzes.update_one(
            {"quiz_id": quiz_id},
            {"$set": {"questions": questions, "status": "ready"}},
        )
        await write_audit(user.user_id, "QUIZ_GENERATED", {"quiz_id": quiz_id, "document_id": doc["document_id"]}, ip)
    except Exception as e:
        logger.exception("Background quiz gen gagal")
        await db.quizzes.update_one(
            {"quiz_id": quiz_id},
            {"$set": {"status": "failed", "error": str(e)[:300]}},
        )


@api_router.post("/quiz/generate")
async def quiz_generate(request: Request, payload: QuizGenerateRequest, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": payload.document_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if doc.get("status") != "ready":
        raise HTTPException(400, "Dokumen belum siap dianalisis")

    quiz_id = uuid.uuid4().hex
    quiz_doc = {
        "quiz_id": quiz_id,
        "user_id": user.user_id,
        "document_id": payload.document_id,
        "questions": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quizzes.insert_one(quiz_doc.copy())
    ip = request.client.host if request.client else ""
    asyncio.create_task(_bg_generate_quiz(quiz_id, doc, user, payload.question_count, ip))
    return _public_quiz(quiz_doc)


@api_router.get("/quiz/{quiz_id}")
async def quiz_get(quiz_id: str, user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")
    return _public_quiz(quiz)


async def _bg_grade_quiz(result_id: str, quiz: dict, answers: List[int], user: User, ip: str):
    try:
        feedback = await generate_deep_feedback(quiz, answers, user)
        await db.quiz_results.update_one(
            {"result_id": result_id},
            {"$set": {
                "score": int(feedback.get("score", 0)),
                "summary": feedback.get("summary", ""),
                "items": feedback.get("items", []),
                "status": "ready",
            }},
        )
        await write_audit(user.user_id, "QUIZ_SUBMITTED", {"quiz_id": quiz["quiz_id"], "score": int(feedback.get("score", 0))}, ip)
    except Exception as e:
        logger.exception("Background grading gagal")
        await db.quiz_results.update_one(
            {"result_id": result_id},
            {"$set": {"status": "failed", "error": str(e)[:300]}},
        )


@api_router.post("/quiz/submit")
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
    asyncio.create_task(_bg_grade_quiz(result_id, quiz, payload.answers, user, ip))
    doc.pop("_id", None)
    return doc


@api_router.get("/quiz/result/{result_id}")
async def quiz_result(result_id: str, user: User = Depends(get_current_user)):
    r = await db.quiz_results.find_one({"result_id": result_id, "user_id": user.user_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Hasil tidak ditemukan")
    return r


# ============== Audit & Progress ==============
@api_router.get("/audit-logs")
async def audit_logs(user: User = Depends(get_current_user), limit: int = 100):
    logs = await db.audit_logs.find({"user_id": user.user_id}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


@api_router.get("/progress")
async def progress(user: User = Depends(get_current_user)):
    docs_count = await db.documents.count_documents({"user_id": user.user_id, "status": "ready"})
    quizzes_count = await db.quizzes.count_documents({"user_id": user.user_id})
    results = await db.quiz_results.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    avg_score = round(sum(r.get("score", 0) for r in results) / len(results), 1) if results else 0
    last_results = [
        {"result_id": r["result_id"], "score": r.get("score", 0), "created_at": r["created_at"]}
        for r in results[:10]
    ]
    return {
        "documents": docs_count,
        "quizzes": quizzes_count,
        "average_score": avg_score,
        "recent_results": last_results,
    }


# ============== Mount ==============
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
