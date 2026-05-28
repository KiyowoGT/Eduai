import io
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Literal
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
from services.ai_service import run_analysis_queued, _bg_generate_quiz, _bg_generate_music_for_students
from routers.quizzes import _public_quiz

logger = logging.getLogger(__name__)
router = APIRouter()

class UpdateMaterialPayload(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    key_concepts: Optional[List[dict]] = None
    target_class_rooms: Optional[List[str]] = None

class TeacherQuizGeneratePayload(BaseModel):
    document_id: str
    question_count: int = 5
    target_classes: List[str] = []
    deadline: Optional[str] = None

class TeacherQuizPublishPayload(BaseModel):
    class_name: str
    schedule_id: Optional[str] = None

async def require_can_manage_materials(user: User = Depends(require_pengajar)) -> User:
    is_authorized = any(t in user.all_titles for t in (TeacherTitle.guru_pengajar, TeacherTitle.kajur, TeacherTitle.kurikulum, TeacherTitle.kepala_sekolah))
    is_mandiri = user.account_type == AccountType.pribadi
    if not (is_authorized or is_mandiri):
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak: Hanya Guru Pengajar, Kajur, Kurikulum, Kepala Sekolah, atau Guru Mandiri yang bisa mengelola materi."
        )
    return user

@router.get("/teacher/materials/classes")
async def list_available_classes(user: User = Depends(require_pengajar)):
    if user.account_type == AccountType.pribadi:
        classes = await db.class_tokens.distinct("target_class_room", {"created_by_user_id": user.user_id})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        
        classes = await db.class_tokens.distinct("target_class_room", {"institution_code": user.institution_code})
        
        active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
        if active_year:
            year_classes = await db.classes.distinct("name", {"institution_code": user.institution_code, "academic_year_id": active_year["academic_year_id"]})
            classes = list(set(classes + year_classes))
        
        # Include assigned_class and teaching_classes from all teachers in this institution
        inst_users = await db.users.find(
            {"institution_code": user.institution_code, "role": "pengajar"},
            {"assigned_class": 1, "teaching_classes": 1, "_id": 0}
        ).to_list(500)
        for u in inst_users:
            if u.get("assigned_class") and u["assigned_class"] not in classes:
                classes.append(u["assigned_class"])
            for c in (u.get("teaching_classes") or []):
                if c and c not in classes:
                    classes.append(c)
            
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

    subject_name = subject_name.strip()
    if not subject_name:
        raise HTTPException(400, "Nama mata pelajaran wajib diisi")

    if user.account_type != AccountType.pribadi and user.assigned_subject:
        if subject_name.lower() != user.assigned_subject.lower():
            raise HTTPException(403, f"Guru pengajar hanya diperbolehkan mengunggah materi untuk mata pelajaran mereka sendiri ({user.assigned_subject})")

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
        "target_class_room": class_rooms[0] if class_rooms else None,
        "target_class_rooms": class_rooms,
        "visibility": "private" if user.account_type == AccountType.pribadi else "institution",
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
            "status": {"$ne": "deleted"},
            "$or": [
                {"user_id": user.user_id},
                {"institution_code": user.institution_code, "visibility": "institution"},
            ],
        }

        or_conditions = [{"user_id": user.user_id}]
        has_scope = False

        is_admin_or_kajur = user.title in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.kajur)

        if not is_admin_or_kajur:
            if TeacherTitle.guru_kelas in user.all_titles:
                has_scope = True
                if user.assigned_class:
                    or_conditions.extend([
                        {"target_class_room": user.assigned_class},
                        {"target_class_rooms": user.assigned_class}
                    ])
            if TeacherTitle.guru_pengajar in user.all_titles:
                has_scope = True
                if user.assigned_subject:
                    or_conditions.append({"subject_name": user.assigned_subject})

            if has_scope:
                query["$and"] = [
                    {"$or": query["$or"]},
                    {"$or": or_conditions},
                ]
                query.pop("$or", None)

    docs = await db.documents.find(query, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(200)

    doc_ids = [d["document_id"] for d in docs]
    quizzes = await db.quizzes.find({"document_id": {"$in": doc_ids}}).to_list(1000)

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


def is_general_subject(subject_name: Optional[str]) -> bool:
    if not subject_name:
        return False
    name = subject_name.lower().strip()
    keywords = [
        "agama", "pancasila", "ppkn", "bahasa indonesia", "bahasa inggris",
        "sejarah", "pjok", "penjasorkes", "seni budaya", "seni", "pai", "jasmani"
    ]
    return any(kw in name for kw in keywords)


@router.get("/teacher/materials/pending-review")
async def list_pending_review_materials(user: User = Depends(require_pengajar)):
    if user.title not in (TeacherTitle.kajur, TeacherTitle.kurikulum, TeacherTitle.kepala_sekolah):
        raise HTTPException(403, "Hanya Kajur, Kurikulum, atau Kepala Sekolah yang dapat melihat antrian review")

    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    query = {
        "institution_code": user.institution_code,
        "status": "pending_review",
        "user_id": {"$ne": user.user_id},
    }

    # Kajur: only productive/vocational subjects
    if user.title == TeacherTitle.kajur:
        all_subjects = await db.documents.distinct("subject_name", query)
        productive = [s for s in all_subjects if s and not is_general_subject(s)]
        if not productive:
            return []
        query["subject_name"] = {"$in": productive}

    docs = await db.documents.find(query, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(200)

    # Enrich with teacher name
    user_ids = [d["user_id"] for d in docs if d.get("user_id")]
    teachers = {}
    if user_ids:
        cursor = db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1})
        async for t in cursor:
            teachers[t["user_id"]] = t.get("name", "Guru")

    for d in docs:
        d["teacher_name"] = teachers.get(d.get("user_id"), "Guru")

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

    is_admin_or_kajur = user.title in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.kajur)
    is_allowed = (
        doc.get("user_id") == user.user_id or
        is_admin_or_kajur or
        (user.account_type != AccountType.pribadi and (
            (user.assigned_subject and doc.get("subject_name") == user.assigned_subject) or
            (user.title == TeacherTitle.guru_kelas and (
                doc.get("target_class_room") == user.assigned_class or
                user.assigned_class in doc.get("target_class_rooms", [])
            ))
        ))
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
    if payload.target_class_rooms is not None:
        updates["target_class_rooms"] = payload.target_class_rooms
        updates["target_class_room"] = payload.target_class_rooms[0] if payload.target_class_rooms else None

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
        (user.account_type != AccountType.pribadi and (
            (user.assigned_subject and doc.get("subject_name") == user.assigned_subject) or
            (TeacherTitle.guru_kelas in user.all_titles and (
                doc.get("target_class_room") == user.assigned_class or
                user.assigned_class in doc.get("target_class_rooms", [])
            ))
        ))
    )
    if not is_allowed:
        raise HTTPException(403, "Anda tidak memiliki akses untuk mempublikasikan materi ini")

    if doc.get("status") == "processing":
        raise HTTPException(400, "Materi masih dalam proses analisis AI. Mohon tunggu beberapa saat.")

    is_admin_or_kajur = user.title in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.kajur)
    is_sd_or_smp = user.education_level and user.education_level.upper() in ("SD", "SMP")
    
    is_general = is_general_subject(doc.get("subject_name"))
    new_status = "published" if (user.account_type == AccountType.pribadi or is_admin_or_kajur or is_general or is_sd_or_smp) else "pending_review"
    
    update_data = {
        "status": new_status,
    }
    if new_status == "published":
        update_data["published_at"] = datetime.now(timezone.utc).isoformat()
        update_data["published_by"] = user.user_id
        target_classes = doc.get("target_class_rooms") or ([doc.get("target_class_room")] if doc.get("target_class_room") else [])
        if target_classes and user.institution_code and doc.get("summary"):
            asyncio.create_task(_bg_generate_music_for_students(doc_id, target_classes, user.institution_code))
    else:
        update_data["submitted_for_review_at"] = datetime.now(timezone.utc).isoformat()
        update_data["submitted_by"] = user.user_id

    await db.documents.update_one(
        {"document_id": doc_id},
        {"$set": update_data}
    )

    await write_audit(
        user.user_id,
        "TEACHER_MATERIAL_PUBLISH_REQUEST" if new_status == "pending_review" else "TEACHER_MATERIAL_PUBLISHED",
        {"document_id": doc_id, "subject_name": doc.get("subject_name")},
        request.client.host if request.client else ""
    )

    updated_doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
    return updated_doc

class ReviewMaterialPayload(BaseModel):
    decision: Literal["approve", "reject"]
    comment: Optional[str] = None

@router.post("/teacher/materials/{doc_id}/review")
async def review_teacher_material(
    doc_id: str,
    payload: ReviewMaterialPayload,
    request: Request,
    user: User = Depends(require_pengajar)
):
    is_admin_or_kajur = user.title in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.kajur)
    if not is_admin_or_kajur:
        raise HTTPException(403, "Hanya Kepala Jurusan, Kurikulum, atau Kepala Sekolah yang dapat meninjau materi")

    doc = await db.documents.find_one({"document_id": doc_id, "institution_code": user.institution_code, "status": {"$ne": "deleted"}}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Materi tidak ditemukan")

    if doc.get("status") != "pending_review":
        raise HTTPException(400, "Materi tidak dalam status menunggu persetujuan (pending_review)")

    if payload.decision == "approve":
        await db.documents.update_one(
            {"document_id": doc_id},
            {"$set": {
                "status": "published",
                "published_at": datetime.now(timezone.utc).isoformat(),
                "published_by": doc.get("submitted_by") or user.user_id,
                "approved_by": user.user_id,
                "review_comment": payload.comment
            }}
        )
        target_classes = doc.get("target_class_rooms") or ([doc.get("target_class_room")] if doc.get("target_class_room") else [])
        if target_classes and user.institution_code and doc.get("summary"):
            asyncio.create_task(_bg_generate_music_for_students(doc_id, target_classes, user.institution_code))
        audit_type = "TEACHER_MATERIAL_APPROVED"
    else:
        await db.documents.update_one(
            {"document_id": doc_id},
            {"$set": {
                "status": "ready",
                "review_comment": payload.comment,
                "rejected_by": user.user_id,
                "rejected_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        audit_type = "TEACHER_MATERIAL_REJECTED"

    await write_audit(
        user.user_id,
        audit_type,
        {"document_id": doc_id, "comment": payload.comment},
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

    is_admin_or_kajur = user.title in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum, TeacherTitle.kajur)
    is_allowed = (
        doc.get("user_id") == user.user_id or
        is_admin_or_kajur or
        (user.account_type != AccountType.pribadi and (
            (user.assigned_subject and doc.get("subject_name") == user.assigned_subject) or
            (user.title == TeacherTitle.guru_kelas and (
                doc.get("target_class_room") == user.assigned_class or
                user.assigned_class in doc.get("target_class_rooms", [])
            ))
        ))
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
        "target_class_rooms": payload.target_classes or [],
        "deadline": payload.deadline,
        "questions": [],
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quizzes.insert_one(quiz_doc.copy())

    ip = request.client.host if request.client else ""
    asyncio.create_task(_bg_generate_quiz(quiz_id, [doc], user, payload.question_count, ip, ""))

    if payload.target_classes:
        asyncio.create_task(_bg_auto_publish_quiz(quiz_id, payload.target_classes, payload.deadline, user.user_id))

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
        (user.account_type != AccountType.pribadi and (
            (user.assigned_subject and quiz.get("subject_name") == user.assigned_subject) or
            (TeacherTitle.guru_kelas in user.all_titles and quiz.get("class_name") == user.assigned_class)
        ))
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
            "target_class_rooms": [payload.class_name],
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


async def _bg_auto_publish_quiz(quiz_id: str, target_classes: list, deadline: Optional[str], published_by: str):
    for _ in range(90):
        quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
        if not quiz:
            return
        if quiz.get("status") != "processing":
            break
        await asyncio.sleep(1)

    update = {
        "class_name": target_classes[0] if target_classes else None,
        "target_class_rooms": target_classes,
        "status": "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "published_by": published_by,
    }
    if deadline:
        update["deadline"] = deadline

    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": update})
