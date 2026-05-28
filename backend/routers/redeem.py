import re
import uuid
import time
import random
import string
import logging
import asyncio
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from core.database import db
from models.user import User, AccountType
from models.quiz import RedeemCodeCreate, RedeemQuizSubmit
from deps.auth import get_current_user, require_pengajar, write_audit
from services.ai_service import generate_deep_feedback

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/redeem", tags=["redeem"])

# ============== In-Memory Rate Limiting ==============
_rate_limits = defaultdict(list)
RATE_LIMIT_LIMIT = 10
RATE_LIMIT_WINDOW = 60  # seconds

def check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    # Clean up old request timestamps
    _rate_limits[ip] = [t for t in _rate_limits[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limits[ip]) >= RATE_LIMIT_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Terlalu banyak permintaan (maksimal 10 per menit). Silakan coba lagi nanti."
        )
    _rate_limits[ip].append(now)

# ============== Helper Functions ==============
async def generate_unique_redeem_code(subject_name: str) -> str:
    subj_clean = re.sub(r'[^a-zA-Z]', '', subject_name).upper()
    prefix = subj_clean[:3] if len(subj_clean) >= 3 else "KUS"
    
    for attempt in range(10):
        rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        code = f"{prefix}-LES-{rand_suffix}"
        existing = await db.redeem_codes.find_one({"code": code})
        if not existing:
            return code
            
    rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"LES-{rand_suffix}"

async def get_optional_user(request: Request) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    try:
        return await get_current_user(request)
    except Exception:
        return None

# ============== Background Grading Task ==============
async def _bg_grade_student_session(session_id: str, quiz: dict, answers: List[int], student_user: User, ip: str):
    try:
        # Generate deep academic feedback via AI
        feedback = await generate_deep_feedback(quiz, answers, student_user)
        
        # Verify the session still exists
        current = await db.student_sessions.find_one({"session_id": session_id})
        if not current:
            return
            
        await db.student_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "score": int(feedback.get("score", 0)),
                "summary": feedback.get("summary", ""),
                "items": feedback.get("items", []),
                "status": "ready"
            }}
        )
        logger.info(f"Student session {session_id} graded successfully. Score: {feedback.get('score')}")
    except Exception as e:
        logger.exception(f"Background student session grading failed: {e}")
        await db.student_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "failed", "error": str(e)[:300]}}
        )

@router.get("/my-sessions")
async def list_my_redeem_sessions(user: User = Depends(get_current_user)):
    sessions = await db.student_sessions.find(
        {"student_user_id": user.user_id},
        {"_id": 0, "session_token": 0}
    ).sort("submitted_at", -1).limit(50).to_list(50)

    for s in sessions:
        quiz = await db.quizzes.find_one(
            {"quiz_id": s["quiz_id"]},
            {"_id": 0, "source_titles": 1, "subject_name": 1}
        )
        if quiz:
            s["quiz_title"] = quiz.get("source_titles", ["Kuis"])[0] if quiz.get("source_titles") else "Kuis Mandiri"
            if not s.get("subject_name"):
                s["subject_name"] = quiz.get("subject_name")

    return {"sessions": sessions}

@router.get("/my-materials")
async def list_my_redeem_materials(user: User = Depends(get_current_user)):
    sessions = await db.student_sessions.find(
        {"student_user_id": user.user_id, "status": "ready"},
        {"_id": 0, "quiz_id": 1}
    ).sort("submitted_at", -1).limit(50).to_list(50)

    if not sessions:
        return {"materials": []}

    quiz_ids = list(set(s.get("quiz_id") for s in sessions if s.get("quiz_id")))
    if not quiz_ids:
        return {"materials": []}

    redeem_codes = await db.redeem_codes.find(
        {"quiz_id": {"$in": quiz_ids}},
        {"_id": 0, "quiz_id": 1, "code": 1}
    ).to_list(50)
    code_by_quiz = {rc["quiz_id"]: rc["code"] for rc in redeem_codes}

    quizzes = await db.quizzes.find(
        {"quiz_id": {"$in": quiz_ids}},
        {"_id": 0, "document_ids": 1, "source_titles": 1, "subject_name": 1}
    ).to_list(50)

    doc_ids = set()
    for q in quizzes:
        for did in (q.get("document_ids") or []):
            doc_ids.add(did)
        if q.get("document_id"):
            doc_ids.add(q["document_id"])

    if not doc_ids:
        return {"materials": []}

    docs = await db.documents.find(
        {"document_id": {"$in": list(doc_ids)}},
        {"_id": 0,
         "document_id": 1, "title": 1, "filename": 1,
         "subject_name": 1, "summary": 1,
         "user_id": 1, "created_at": 1}
    ).to_list(50)

    quiz_docs_map = {}
    for q in quizzes:
        qid = q["quiz_id"]
        q_doc_ids = set()
        for did in (q.get("document_ids") or []):
            q_doc_ids.add(did)
        if q.get("document_id"):
            q_doc_ids.add(q["document_id"])
        quiz_docs_map[qid] = q_doc_ids

    materials = []
    for q in quizzes:
        qid = q["quiz_id"]
        code = code_by_quiz.get(qid, "")
        quiz_title = (q.get("source_titles") or ["Kuis"])[0] if q.get("source_titles") else "Kuis Mandiri"
        subject = q.get("subject_name") or ""
        q_doc_ids = quiz_docs_map.get(qid, set())
        for doc in docs:
            if doc["document_id"] in q_doc_ids:
                materials.append({
                    **doc,
                    "redeem_code": code,
                    "quiz_title": quiz_title,
                    "quiz_subject": subject,
                })

    return {"materials": materials}

# ============== Endpoints ==============

@router.post("/teacher/quizzes/{quiz_id}/redeem-code")
async def generate_redeem_code(
    quiz_id: str,
    payload: RedeemCodeCreate,
    request: Request,
    user: User = Depends(require_pengajar)
):
    if user.account_type != AccountType.pribadi:
        raise HTTPException(status_code=403, detail="Akses ditolak: Hanya Guru Mandiri yang bisa menerbitkan kode kuis les.")

    # 1. Atomic quiz locking (change status draft/ready to published)
    quiz = await db.quizzes.find_one_and_update(
        {"quiz_id": quiz_id, "user_id": user.user_id, "status": {"$in": ["ready", "published"]}},
        {"$set": {"status": "published", "is_locked": True}},
        return_document=True
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Kuis tidak ditemukan atau kuis masih dalam proses AI.")

    subject_name = quiz.get("subject_name") or "Kuis"
    code = await generate_unique_redeem_code(subject_name)
    
    expires_at_iso = None
    if payload.expires_at:
        expires_at_iso = payload.expires_at.isoformat()

    redeem_doc = {
        "code": code,
        "quiz_id": quiz_id,
        "created_by": user.user_id,
        "expires_at": expires_at_iso,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.redeem_codes.insert_one(redeem_doc.copy())
    await write_audit(user.user_id, "REDEEM_CODE_GENERATED", {"code": code, "quiz_id": quiz_id}, request.client.host if request.client else "")
    
    return redeem_doc

@router.get("/{code}")
async def validate_and_get_redeem_quiz(
    code: str,
    request: Request,
    rate_limit: None = Depends(check_rate_limit)
):
    code = code.strip().upper()
    redeem = await db.redeem_codes.find_one({"code": code})
    if not redeem:
        raise HTTPException(status_code=404, detail="Kode redeem tidak valid atau sudah kadaluwarsa.")

    quiz = await db.quizzes.find_one({"quiz_id": redeem["quiz_id"]})
    if not quiz:
        raise HTTPException(status_code=404, detail="Kuis terkait tidak ditemukan.")

    # Sanitasi: sembunyikan correct_index dari respon client
    questions = quiz.get("questions") or []
    sanitized_questions = []
    for q in questions:
        sanitized_questions.append({
            "id": q.get("id"),
            "question": q.get("question"),
            "options": q.get("options"),
            "skill_type": q.get("skill_type"),
            "source_title": q.get("source_title")
        })

    return {
        "code": code,
        "quiz_id": quiz["quiz_id"],
        "title": quiz.get("source_titles", ["Kuis"])[0] if quiz.get("source_titles") else "Kuis Mandiri",
        "subject_name": quiz.get("subject_name"),
        "questions": sanitized_questions,
        "source_titles": quiz.get("source_titles", [])
    }

@router.post("/{code}/start")
async def start_redeem_quiz(
    code: str,
    request: Request,
    rate_limit: None = Depends(check_rate_limit)
):
    code = code.strip().upper()
    redeem = await db.redeem_codes.find_one({"code": code})
    if not redeem:
        raise HTTPException(status_code=404, detail="Kode redeem tidak valid atau sudah kadaluwarsa.")

    session_id = uuid.uuid4().hex
    session_token = uuid.uuid4().hex
    
    session_doc = {
        "session_id": session_id,
        "session_token": session_token,
        "redeem_code": code,
        "quiz_id": redeem["quiz_id"],
        "status": "started",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "last_heartbeat": datetime.now(timezone.utc).isoformat()
    }
    await db.student_sessions.insert_one(session_doc.copy())
    
    return {"session_id": session_id, "session_token": session_token}

@router.post("/{code}/heartbeat")
async def heartbeat_redeem_quiz(
    code: str,
    session_id: str,
    session_token: str,
    request: Request
):
    session = await db.student_sessions.find_one({"session_id": session_id, "session_token": session_token})
    if not session:
        raise HTTPException(status_code=404, detail="Sesi pengerjaan tidak ditemukan.")

    if session.get("status") != "started":
        return {"status": session["status"]}

    await db.student_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"last_heartbeat": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}

@router.post("/{code}/submit")
async def submit_redeem_quiz(
    code: str,
    payload: RedeemQuizSubmit,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    rate_limit: None = Depends(check_rate_limit)
):
    code = code.strip().upper()
    redeem = await db.redeem_codes.find_one({"code": code})
    if not redeem:
        raise HTTPException(status_code=404, detail="Kode redeem tidak valid atau sudah kadaluwarsa.")

    session = await db.student_sessions.find_one({"session_token": payload.session_token, "redeem_code": code})
    if not session:
        raise HTTPException(status_code=404, detail="Sesi kuis tidak valid.")

    if session.get("status") in ["processing", "ready"]:
        raise HTTPException(status_code=409, detail="Jawaban kuis untuk sesi ini sudah dikirimkan.")

    # 1. Check timeout idle (>45 min)
    started_at = datetime.fromisoformat(session["started_at"])
    now = datetime.now(timezone.utc)
    if now - started_at > timedelta(minutes=45):
        raise HTTPException(status_code=400, detail="Waktu pengerjaan kuis telah habis (melebihi batas 45 menit).")

    quiz = await db.quizzes.find_one({"quiz_id": redeem["quiz_id"]})
    if not quiz:
        raise HTTPException(status_code=404, detail="Kuis tidak ditemukan.")

    questions = quiz.get("questions") or []
    if len(payload.answers) != len(questions):
        raise HTTPException(status_code=400, detail=f"Jumlah jawaban tidak sesuai. Diperlukan {len(questions)} jawaban.")

    # 2. Grade quiz score synchronously (base logic)
    correct_count = 0
    for idx, q in enumerate(questions):
        ans = payload.answers[idx]
        if ans == q.get("correct_index"):
            correct_count += 1
    
    score = round((correct_count / len(questions)) * 100) if len(questions) > 0 else 0

    student_user_id = current_user.user_id if current_user else None

    # 3. Update student session
    await db.student_sessions.update_one(
        {"session_id": session["session_id"]},
        {"$set": {
            "student_identifier": payload.student_identifier,
            "student_user_id": student_user_id,
            "answers": payload.answers,
            "score": score,
            "status": "processing",
            "submitted_at": now.isoformat()
        }}
    )

    # 4. Increment usage count
    await db.redeem_codes.update_one(
        {"code": code},
        {"$inc": {"usage_count": 1}}
    )

    # 5. Shadow Workspace Logic: B2B student submitting private quiz
    if current_user and current_user.institution_code:
        # Save copy to quiz_results for student portfolio with institution_code = None
        result_id = uuid.uuid4().hex
        await db.quiz_results.insert_one({
            "result_id": result_id,
            "quiz_id": quiz["quiz_id"],
            "document_id": quiz.get("document_id"),
            "user_id": current_user.user_id,
            "created_by": quiz.get("user_id"),
            "answers": payload.answers,
            "score": score,
            "summary": "Shadow quiz session",
            "status": "ready",
            "institution_code": None,  # 🔥 CRITICAL: Prevent showing in school dashboard
            "source": "saas_redeem",
            "created_at": now.isoformat()
        })

    # Prepare Mock User for AI feedback generation
    student_name = payload.student_identifier
    feedback_student = User(
        user_id=student_user_id or "anonymous",
        email=current_user.email if current_user else "anonymous@eduai.com",
        name=student_name,
        role="pelajar",
        teaching_methods=current_user.teaching_methods if current_user else ["real_world", "imagination"],
        created_at=now
    )

    # 6. Trigger AI Grading background task
    ip = request.client.host if request.client else ""
    asyncio.create_task(_bg_grade_student_session(session["session_id"], quiz, payload.answers, feedback_student, ip))

    return {
        "session_id": session["session_id"],
        "status": "processing",
        "score": score
    }

@router.get("/session/{session_id}")
async def get_redeem_session(session_id: str):
    session = await db.student_sessions.find_one({"session_id": session_id}, {"_id": 0, "session_token": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Sesi pengerjaan tidak ditemukan.")
    
    if session.get("status") == "ready":
        # Include quiz questions with options (still strip correct_index to prevent inspecting after submission if needed, or return full feedback details)
        quiz = await db.quizzes.find_one({"quiz_id": session["quiz_id"]})
        if quiz:
            session["source_titles"] = quiz.get("source_titles", [])
            session["questions"] = []
            for i, q in enumerate(quiz.get("questions", [])):
                fb_item = {}
                if session.get("items") and i < len(session["items"]):
                    fb_item = session["items"][i]
                session["questions"].append({
                    "question": q.get("question"),
                    "options": q.get("options"),
                    "correct_index": q.get("correct_index"),
                    "user_answer_index": session.get("answers", [])[i] if i < len(session.get("answers", [])) else -1,
                    "is_correct": fb_item.get("is_correct") if fb_item else (session.get("answers", [])[i] == q.get("correct_index")),
                    "explanation": fb_item.get("explanation", "") if fb_item else "",
                    "references": fb_item.get("references", []) if fb_item else []
                })
    return session
