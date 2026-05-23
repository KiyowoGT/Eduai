import io
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path
from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form
from pydantic import BaseModel

from core.database import db
from core.config import UPLOAD_DIR, MAX_UPLOAD_BYTES
from models.user import User, TeacherTitle, AccountType
from deps.auth import get_current_user, require_pengajar, require_title, write_audit
from routers.documents import (
    _ensure_within_upload_limit,
    _try_upload_supabase,
    ALLOWED_IMAGE_TYPES,
    PIL_AVAILABLE,
    Image
)
from services.ai_service import run_analysis_queued, _bg_generate_quiz
from routers.quizzes import _public_quiz

logger = logging.getLogger(__name__)
router = APIRouter()

class UpdateMaterialPayload(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    key_concepts: Optional[List[dict]] = None

class TeacherQuizGeneratePayload(BaseModel):
    document_id: str
    question_count: int = 5

class TeacherQuizPublishPayload(BaseModel):
    class_name: str
    schedule_id: Optional[str] = None

async def require_can_manage_materials(user: User = Depends(require_pengajar)) -> User:
    is_guru_pengajar = user.title == TeacherTitle.guru_pengajar
    is_mandiri = user.account_type == AccountType.pribadi
    if not (is_guru_pengajar or is_mandiri):
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak: Hanya Guru Pengajar atau Guru Mandiri yang bisa mengelola materi."
        )
    return user

@router.get("/teacher/materials/classes")
async def list_available_classes(user: User = Depends(require_pengajar)):
    if user.account_type == AccountType.pribadi:
        # Personal teachers: list unique classes they created tokens for
        classes = await db.class_tokens.distinct("target_class_room", {"created_by_user_id": user.user_id})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        
        # Institutional teachers: list all unique classes in the institution
        classes = await db.class_tokens.distinct("target_class_room", {"institution_code": user.institution_code})
        
        # Also include assigned class if not in the list
        if user.assigned_class and user.assigned_class not in classes:
            classes.append(user.assigned_class)
            
    return sorted(classes)

@router.post("/teacher/materials/upload")
async def upload_teacher_material(
    request: Request,
    file: UploadFile = File(...),
    subject_name: str = Form(...),
    target_class_room: Optional[str] = Form(None), # Backward compatibility
    target_classes: Optional[str] = Form(None),   # New: JSON array string
    user: User = Depends(require_can_manage_materials)
):
    if user.account_type != AccountType.pribadi and not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    # Scope validation
    subject_name = subject_name.strip()
    if not subject_name:
        raise HTTPException(400, "Nama mata pelajaran wajib diisi")

    if user.account_type != AccountType.pribadi:
        if not user.assigned_subject or subject_name.lower() != user.assigned_subject.lower():
            raise HTTPException(403, f"Guru pengajar hanya diperbolehkan mengunggah materi untuk mata pelajaran mereka sendiri ({user.assigned_subject})")

    # Parse target_classes if provided
    class_rooms = []
    if target_classes:
        import json
        try:
            class_rooms = json.loads(target_classes)
            if not isinstance(class_rooms, list):
                class_rooms = [str(class_rooms)]
        except:
            class_rooms = [target_classes]
    elif target_class_room:
        class_rooms = [target_class_room]

    # ... rest of validation logic ...

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    is_image = file.content_type in ALLOWED_IMAGE_TYPES or ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp")
    is_pdf = ext == ".pdf" or file.content_type == "application/pdf"
    
    if not is_image and not is_pdf:
        raise HTTPException(400, "Format tidak didukung. Gunakan PDF atau gambar (JPG/PNG/WEBP/BMP).")

    content_length = request.headers.get("content-length")
    if content_length:
        total_bytes = int(content_length)
        if total_bytes > MAX_UPLOAD_BYTES:
            max_mb = round(MAX_UPLOAD_BYTES / (1024 * 1024), 1)
            raise HTTPException(413, f"File terlalu besar. Maksimal {max_mb}MB.")

    doc_id = uuid.uuid4().hex
    saved_path = UPLOAD_DIR / f"{doc_id}.pdf"

    if is_image:
        if not PIL_AVAILABLE:
            raise HTTPException(400, "Konversi gambar ke PDF tidak tersedia di server ini.")
        contents = await file.read()
        _ensure_within_upload_limit(len(contents), file.filename)
        try:
            img = Image.open(io.BytesIO(contents))
            if img.mode == "RGBA":
                img = img.convert("RGB")
            pdf_bytes_io = io.BytesIO()
            img.save(pdf_bytes_io, format="PDF")
            pdf_bytes = pdf_bytes_io.getvalue()
        except Exception as e:
            raise HTTPException(400, f"Gagal konversi gambar {file.filename} ke PDF: {str(e)}")
        finally:
            file.file.close()
    else:
        pdf_bytes = await file.read()
        _ensure_within_upload_limit(len(pdf_bytes), file.filename)

    # Check academic content (HITL Filter)
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = ""
        for i in range(min(5, len(reader.pages))):
            extracted_text += reader.pages[i].extract_text() or ""
        
        NON_ACADEMIC_KEYWORDS = [
            "bimbingan konseling",
            "inventaris",
            "keuangan sekolah",
            "psikologi personal"
        ]
        text_lower = extracted_text.lower()
        if any(kw in text_lower for kw in NON_ACADEMIC_KEYWORDS):
            raise HTTPException(
                400,
                "Konten dokumen tidak sesuai ruang lingkup akademik formal. "
                "Sistem menolak materi bertopik BK, inventaris, keuangan, atau psikologi personal."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Gagal melakukan pre-filter teks PDF: {e}")

    _ensure_within_upload_limit(len(pdf_bytes), f"{file.filename} (setelah konversi)")

    with saved_path.open("wb") as f:
        f.write(pdf_bytes)

    try:
        await db.pdf_files.insert_one({
            "document_id": doc_id,
            "user_id": user.user_id,
            "data": Binary(pdf_bytes),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"Gagal simpan PDF ke MongoDB: {e}")

    asyncio.create_task(_try_upload_supabase(user.user_id, doc_id, str(saved_path)))

    doc = {
        "document_id": doc_id,
        "user_id": user.user_id,
        "institution_code": user.institution_code,
        "filename": file.filename,
        "title": file.filename,
        "file_path": str(saved_path),
        "summary": "",
        "key_concepts": [],
        "diagrams": [],
        "learning_objectives": [],
        "subject_name": subject_name,
        "target_class_room": class_rooms[0] if class_rooms else None, # Legacy
        "target_class_rooms": class_rooms, # New multi-class support
        "visibility": "institution",
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc.copy())
    
    ip = request.client.host if request.client else ""
    await write_audit(user.user_id, "TEACHER_MATERIAL_UPLOAD", {
        "document_id": doc_id, 
        "filename": file.filename, 
        "subject_name": subject_name,
        "target_classes": class_rooms
    }, ip)

    asyncio.create_task(run_analysis_queued(doc_id, str(saved_path), user, ip))

    res = doc.copy()
    res.pop("file_path", None)
    return res

@router.get("/teacher/materials")
async def list_teacher_materials(user: User = Depends(require_pengajar)):
    if user.account_type == AccountType.pribadi:
        query = {
            "user_id": user.user_id,
            "status": {"$ne": "deleted"}
        }
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")

        query = {
            "institution_code": user.institution_code,
            "visibility": "institution",
            "status": {"$ne": "deleted"}
        }

        # Apply scopes based on teacher title
        if user.title == TeacherTitle.guru_kelas:
            query["$or"] = [
                {"target_class_room": user.assigned_class},
                {"target_class_rooms": user.assigned_class}
            ]
        elif user.title == TeacherTitle.guru_pengajar:
            query["subject_name"] = user.assigned_subject

    docs = await db.documents.find(query, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(200)
    
    # Fetch quizzes for these documents
    doc_ids = [d["document_id"] for d in docs]
    quizzes = await db.quizzes.find({"document_id": {"$in": doc_ids}}).to_list(1000)
    
    # Map quizzes to documents
    quizzes_by_doc = {}
    for q in quizzes:
        q_clean = {
            "quiz_id": q["quiz_id"],
            "status": q["status"],
            "created_at": q["created_at"],
            "class_name": q.get("class_name"),
            "subject_name": q.get("subject_name"),
            "source_titles": q.get("source_titles", [])
        }
        
        # Check if there is a redeem code generated for this quiz
        redeem = await db.redeem_codes.find_one({"quiz_id": q["quiz_id"]})
        if redeem:
            q_clean["redeem_code"] = redeem["code"]
            q_clean["redeem_expires_at"] = redeem.get("expires_at")
            q_clean["redeem_usage_count"] = redeem.get("usage_count", 0)
            
        doc_id = q["document_id"]
        if doc_id not in quizzes_by_doc:
            quizzes_by_doc[doc_id] = []
        quizzes_by_doc[doc_id].append(q_clean)
        
    for d in docs:
        d["quizzes"] = quizzes_by_doc.get(d["document_id"], [])
        
    return docs

@router.put("/teacher/materials/{doc_id}")
async def update_teacher_material(
    doc_id: str,
    payload: UpdateMaterialPayload,
    request: Request,
    user: User = Depends(require_can_manage_materials)
):
    if user.account_type == AccountType.pribadi:
        doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        doc = await db.documents.find_one({"document_id": doc_id, "institution_code": user.institution_code, "status": {"$ne": "deleted"}}, {"_id": 0})

    if not doc:
        raise HTTPException(404, "Materi tidak ditemukan")

    is_allowed = (
        doc.get("user_id") == user.user_id or
        (user.account_type != AccountType.pribadi and doc.get("subject_name") == user.assigned_subject)
    )
    if not is_allowed:
        raise HTTPException(403, "Anda tidak memiliki akses untuk mengubah materi ini")

    updates = {}
    if payload.title is not None:
        updates["title"] = payload.title
    if payload.summary is not None:
        updates["summary"] = payload.summary
    if payload.key_concepts is not None:
        updates["key_concepts"] = payload.key_concepts

    if updates:
        await db.documents.update_one({"document_id": doc_id}, {"$set": updates})
        await write_audit(
            user.user_id,
            "TEACHER_MATERIAL_UPDATED",
            {"document_id": doc_id, "updates": list(updates.keys())},
            request.client.host if request.client else ""
        )

    updated_doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
    return updated_doc

@router.post("/teacher/materials/{doc_id}/publish")
async def publish_teacher_material(
    doc_id: str,
    request: Request,
    user: User = Depends(require_can_manage_materials)
):
    if user.account_type == AccountType.pribadi:
        doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        doc = await db.documents.find_one({"document_id": doc_id, "institution_code": user.institution_code, "status": {"$ne": "deleted"}}, {"_id": 0})

    if not doc:
        raise HTTPException(404, "Materi tidak ditemukan")

    is_allowed = (
        doc.get("user_id") == user.user_id or
        (user.account_type != AccountType.pribadi and doc.get("subject_name") == user.assigned_subject)
    )
    if not is_allowed:
        raise HTTPException(403, "Anda tidak memiliki akses untuk mempublikasikan materi ini")

    if doc.get("status") == "processing":
        raise HTTPException(400, "Materi masih dalam proses analisis AI. Mohon tunggu beberapa saat.")

    await db.documents.update_one(
        {"document_id": doc_id},
        {"$set": {
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": user.user_id
        }}
    )

    await write_audit(
        user.user_id,
        "TEACHER_MATERIAL_PUBLISHED",
        {"document_id": doc_id, "subject_name": doc.get("subject_name")},
        request.client.host if request.client else ""
    )

    updated_doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
    return updated_doc

@router.post("/teacher/quizzes/generate")
async def generate_teacher_quiz(
    request: Request,
    payload: TeacherQuizGeneratePayload,
    user: User = Depends(require_can_manage_materials)
):
    if user.account_type == AccountType.pribadi:
        doc = await db.documents.find_one({
            "document_id": payload.document_id,
            "user_id": user.user_id,
            "status": {"$ne": "deleted"}
        }, {"_id": 0})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        doc = await db.documents.find_one({
            "document_id": payload.document_id,
            "institution_code": user.institution_code,
            "status": {"$ne": "deleted"}
        }, {"_id": 0})

    if not doc:
        raise HTTPException(404, "Dokumen/Materi tidak ditemukan")

    is_allowed = (
        doc.get("user_id") == user.user_id or
        (user.account_type != AccountType.pribadi and doc.get("subject_name") == user.assigned_subject)
    )
    if not is_allowed:
        raise HTTPException(403, "Anda tidak memiliki akses untuk membuat kuis dari materi ini")

    if doc.get("status") not in ("ready", "published"):
        raise HTTPException(400, "Materi harus dalam status ready atau published sebelum membuat kuis")

    quiz_id = uuid.uuid4().hex
    quiz_doc = {
        "quiz_id": quiz_id,
        "user_id": user.user_id,
        "institution_code": user.institution_code,
        "document_id": doc["document_id"],
        "document_ids": [doc["document_id"]],
        "source_titles": [doc.get("title") or doc.get("filename")],
        "subject_name": doc.get("subject_name"),
        "questions": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quizzes.insert_one(quiz_doc.copy())

    ip = request.client.host if request.client else ""
    asyncio.create_task(_bg_generate_quiz(quiz_id, [doc], user, payload.question_count, ip, ""))

    return _public_quiz(quiz_doc)

@router.post("/teacher/quizzes/{quiz_id}/publish")
async def publish_teacher_quiz(
    quiz_id: str,
    payload: TeacherQuizPublishPayload,
    request: Request,
    user: User = Depends(require_can_manage_materials)
):
    if user.account_type == AccountType.pribadi:
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "user_id": user.user_id}, {"_id": 0})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id, "institution_code": user.institution_code}, {"_id": 0})

    if not quiz:
        raise HTTPException(404, "Kuis tidak ditemukan")

    is_allowed = (
        quiz.get("user_id") == user.user_id or
        (user.account_type != AccountType.pribadi and quiz.get("subject_name") == user.assigned_subject)
    )
    if not is_allowed:
        raise HTTPException(403, "Anda tidak memiliki akses untuk mempublikasikan kuis ini ke kelas tersebut")

    if quiz.get("status") == "processing":
        raise HTTPException(400, "Kuis masih dalam proses pembuatan AI. Mohon tunggu beberapa saat.")

    await db.quizzes.update_one(
        {"quiz_id": quiz_id},
        {"$set": {
            "status": "published",
            "class_name": payload.class_name,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": user.user_id
        }}
    )

    if payload.schedule_id and user.account_type != AccountType.pribadi:
        schedule = await db.shared_schedules.find_one({"schedule_id": payload.schedule_id, "institution_code": user.institution_code})
        if schedule:
            await db.shared_schedules.update_one(
                {"schedule_id": payload.schedule_id},
                {"$set": {"published_quiz_id": quiz_id}}
            )

    await write_audit(
        user.user_id,
        "TEACHER_QUIZ_PUBLISHED",
        {"quiz_id": quiz_id, "class_name": payload.class_name, "subject_name": quiz.get("subject_name")},
        request.client.host if request.client else ""
    )

    updated_quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    return _public_quiz(updated_quiz)
