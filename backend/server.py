"""EduScanner AI - University Edition - FastAPI Backend"""
import os
import logging
import traceback
import httpx
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import JSONResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
import websockets.exceptions
from bson import Binary

from core.config import (
    API_PREFIX, AUDIO_DIR, GEMINI_API_KEYS, GEMINI_BASE_URL,
    GEMINI_MODEL, GEMINI_ANALYSIS_MODEL, SUPABASE_URL, SUPABASE_ANON_KEY
)
from core.database import db, client
from core.websocket import realtime_hub
from models.user import User
from deps.auth import get_current_user, get_current_user_from_access_token

# Import routers
from routers import (
    auth, documents, quizzes, folders, recaps, chats, friends, audio,
    institutions, class_tokens, teacher_schedules, teacher_materials,
    teacher_analytics, learner_sync, redeem, institution_mgmt, shadow_workspace,
    teacher_students
)

app = fastapi_app = FastAPI(title="EduScanner AI")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

api_router = APIRouter(prefix=API_PREFIX)

@fastapi_app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")
        return response
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Request failed: {e}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {e}", "traceback": tb},
        )

# ============== Websocket Route ==============
@fastapi_app.websocket(f"{API_PREFIX}/ws")
async def websocket_realtime(websocket: WebSocket, token: str = Query(default="")):
    try:
        user = await get_current_user_from_access_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return

    await realtime_hub.connect(user.user_id, websocket)
    try:
        await websocket.send_json({"type": "connected", "user_id": user.user_id})
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, websockets.exceptions.ConnectionClosedError):
        pass
    finally:
        await realtime_hub.disconnect(user.user_id, websocket)

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

@api_router.get("/diag/gemini")
async def diag_gemini():
    gemini_ok = False
    gemini_detail = ""
    keys_status = []
    for idx, key in enumerate(GEMINI_API_KEYS):
        masked = key[:8] + "..." if key else ""
        try:
            url = f"{GEMINI_BASE_URL}/models/{GEMINI_MODEL}:generateContent"
            body = {"contents": [{"role": "user", "parts": [{"text": "Balas: OK"}]}]}
            async with httpx.AsyncClient(timeout=15.0) as hc:
                r = await hc.post(url, json=body, headers={"X-Goog-Api-Key": key})
            ok = r.status_code == 200
            keys_status.append({"key": masked, "ok": ok, "status": r.status_code})
            if ok and not gemini_ok:
                gemini_ok = True
                gemini_detail = f"key{idx + 1} OK"
        except Exception as e:
            keys_status.append({"key": masked, "ok": False, "detail": str(e)[:100]})
    if not gemini_ok:
        gemini_detail = "all keys failed"

    supa_ok = False
    supa_detail = ""
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as hc:
                r = await hc.get(
                    f"{SUPABASE_URL}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                        "apikey": SUPABASE_ANON_KEY,
                        "X-Supabase-Api-Version": "2025-04-01",
                    },
                )
            supa_ok = r.status_code in (200, 401)
            supa_detail = f"status={r.status_code}"
        except Exception as e:
            supa_detail = str(e)[:200]
    else:
        supa_detail = "SUPABASE_URL / ANON_KEY not set"

    return {
        "gemini": {"ok": gemini_ok, "detail": gemini_detail, "model": GEMINI_MODEL, "analysis_model": GEMINI_ANALYSIS_MODEL, "keys": keys_status},
        "supabase": {"ok": supa_ok, "detail": supa_detail, "url": SUPABASE_URL[:30] + "..." if SUPABASE_URL else None},
    }

# ============== Supabase Storage helpers ==============
SUPABASE_STORAGE_URL = f"{SUPABASE_URL}/storage/v1" if SUPABASE_URL else ""

async def _ensure_pdfs_bucket():
    if not SUPABASE_STORAGE_URL or not SUPABASE_URL:
        logger.warning("Supabase not configured, skipping bucket creation")
        return
    try:
        async with httpx.AsyncClient() as hc:
            r = await hc.post(
                f"{SUPABASE_STORAGE_URL}/bucket",
                headers={
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "Content-Type": "application/json",
                },
                json={"id": "pdf", "name": "pdf", "public": True},
            )
            if r.status_code in (200, 201):
                logger.info("Supabase bucket 'pdf' created")
            elif r.status_code == 409:
                logger.info("Supabase bucket 'pdf' already exists")
    except Exception as e:
        logger.warning(f"Failed to create Supabase storage bucket 'pdf': {e}")

# ============== Sync Audio ==============
async def _sync_local_audios_to_mongodb():
    logger.info("Memulai sinkronisasi file audio lokal ke MongoDB...")
    try:
        if not AUDIO_DIR.exists():
            return
        import glob
        wav_files = glob.glob(str(AUDIO_DIR / "*.wav"))
        for file_path_str in wav_files:
            file_path = Path(file_path_str)
            filename = file_path.name

            if file_path.stat().st_size > 15 * 1024 * 1024:
                logger.warning(f"File audio {filename} terlalu besar untuk MongoDB (>15MB), dilewati.")
                continue

            existing = await db.audio_files.find_one({"filename": filename}, {"_id": 1})
            if not existing:
                logger.info(f"Mengunggah file audio baru ke MongoDB: {filename}")
                with open(file_path_str, "rb") as f:
                    data = f.read()
                await db.audio_files.update_one(
                    {"filename": filename},
                    {"$set": {
                        "filename": filename,
                        "data": Binary(data),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
        logger.info("Sinkronisasi audio selesai.")
    except Exception as e:
        logger.warning(f"Gagal melakukan sinkronisasi audio ke MongoDB: {e}")

# ============== Database Indices ==============
async def _ensure_db_indexes():
    """Buat explicit indexes untuk query yang sering digunakan."""
    if db is None:
        return
    try:
        await db.documents.create_index("user_id")
        await db.documents.create_index("document_id", unique=True)
        await db.documents.create_index([("user_id", 1), ("status", 1)])
        await db.folders.create_index("user_id")
        await db.folders.create_index([("user_id", 1), ("status", 1)])
        await db.quizzes.create_index("user_id")
        await db.quizzes.create_index("quiz_id", unique=True)
        await db.quiz_results.create_index("user_id")
        await db.quiz_results.create_index("result_id", unique=True)
        await db.quiz_results.create_index("quiz_id")
        await db.pdf_files.create_index("document_id", unique=True)
        await db.messages.create_index("document_id")
        await db.messages.create_index([("document_id", 1), ("created_at", -1)])
        await db.friend_requests.create_index("target_user_id")
        await db.friend_requests.create_index("from_user_id")
        await db.notifications.create_index("user_id")
        await db.recaps.create_index("user_id")
        await db.institutions.create_index("institution_code", unique=True)
        await db.staff_passcodes.create_index("passcode", unique=True)
        await db.class_tokens.create_index("class_token", unique=True)
        await db.quiz_progress.create_index([("user_id", 1), ("quiz_id", 1)], unique=True)
        
        # Indeks Portal Guru Mandiri
        await db.redeem_codes.create_index("code", unique=True)
        await db.redeem_codes.create_index("quiz_id")
        await db.student_sessions.create_index("session_id", unique=True)
        await db.student_sessions.create_index("redeem_code")
        await db.student_sessions.create_index("quiz_id")
        await db.student_sessions.create_index([("redeem_code", 1), ("score", -1)])
        
        await db.command({
            "collMod": "documents",
            "validator": {},
            "validationLevel": "off",
        })
        await db.command({
            "collMod": "users",
            "validator": {},
            "validationLevel": "off",
        })
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Could not create indexes (may already exist): {e}")

# ============== Startup/Shutdown Lifecycle ==============
@fastapi_app.on_event("startup")
async def startup():
    await _ensure_db_indexes()
    await _ensure_pdfs_bucket()
    await _sync_local_audios_to_mongodb()
    
    # Daftarkan background task pembersihan data sesi anonim >90 hari
    import asyncio
    from tasks.cleanup import cleanup_anonymous_sessions_loop
    asyncio.create_task(cleanup_anonymous_sessions_loop())

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

# ============== Include All Routers ==============
# Legacy Routers
api_router.include_router(auth.router)
api_router.include_router(documents.router)
api_router.include_router(quizzes.router)
api_router.include_router(folders.router)
api_router.include_router(recaps.router)
api_router.include_router(chats.router)
api_router.include_router(friends.router)
api_router.include_router(audio.router)

# Portal Guru Routers
api_router.include_router(institutions.router)
api_router.include_router(class_tokens.router)
api_router.include_router(teacher_schedules.router)
api_router.include_router(teacher_materials.router)
api_router.include_router(teacher_analytics.router)
api_router.include_router(learner_sync.router)
api_router.include_router(redeem.router)
api_router.include_router(institution_mgmt.router)
api_router.include_router(shadow_workspace.router)
api_router.include_router(teacher_students.router)

# Mount the api_router to app
fastapi_app.include_router(api_router)

# Add Middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
