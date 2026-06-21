import io
import os
import json
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path
from bson import Binary
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None

from core.database import db
from core.config import UPLOAD_DIR, AUDIO_DIR, MAX_UPLOAD_BYTES, API_PREFIX
from models.user import User, UserRole, SubjectItem, ScheduleItem, EducationSettingsPayload
from models.document import MaterialGeneratePayload, DocumentMove
from deps.auth import get_current_user, require_pengajar, write_audit
from services.ai_service import (
    _audience,
    _call_groq,
    run_analysis_queued,
    _emit_document_status,
    aimusic_minimax,
    personalize_document_for_student
)
from services.tts_service import _generate_tts
from services.storage import upload_to_supabase_storage, delete_from_supabase_storage, try_upload_supabase
from services.kafka_jobs import (
    enqueue_document_analyze,
    enqueue_storage_upload,
)

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


def _normalize_hobby(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _apply_document_pipeline_defaults(doc: dict, user: User, personalized_ready_ids: Optional[set] = None) -> dict:
    if not doc:
        return doc

    status = doc.get("status")
    if "processing_stage" not in doc:
        if status == "processing":
            doc["processing_stage"] = "hobby" if doc.get("summary") else "analysis"
        else:
            doc["processing_stage"] = None

    hobby = _normalize_hobby(getattr(user, "hobby", None))
    if hobby and hobby != "none":
        ready = False
        if doc.get("skip_hobby_personalization"):
            doc["hobby_status"] = "cancelled"
        else:
            if hobby == "musik":
                genre = (getattr(user, "music_genre", None) or "pop, romantic").strip()
                ready = bool((doc.get("music_summaries") or {}).get(genre))
            elif personalized_ready_ids is not None:
                ready = doc.get("document_id") in personalized_ready_ids
            elif doc.get("hobby_output_ready") is True:
                ready = True

            if "hobby_status" not in doc:
                if ready:
                    doc["hobby_status"] = "ready"
                elif status == "processing" and doc.get("processing_stage") == "hobby":
                    doc["hobby_status"] = "processing"
                else:
                    doc["hobby_status"] = "idle"

        if "hobby_output_ready" not in doc:
            doc["hobby_output_ready"] = ready
    else:
        doc.setdefault("hobby_status", "idle")
        doc.setdefault("hobby_output_ready", False)

    return doc

def _ensure_within_upload_limit(size_bytes: int, filename: str):
    if size_bytes > MAX_UPLOAD_BYTES:
        max_mb = round(MAX_UPLOAD_BYTES / (1024 * 1024), 1)
        raise HTTPException(413, f"Ukuran file {filename} melebihi batas {max_mb} MB")




@router.put("/user/education")
async def save_education_settings(payload: EducationSettingsPayload, request: Request, user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(404, "User tidak ditemukan")

    # Autopilot lock
    if user_doc.get("enrolled_class") or user_doc.get("class_token_used"):
        raise HTTPException(403, "Pengaturan pelajaran dikunci karena akun Anda dalam mode autopilot institusi")

    subjects_out = []
    for subj in payload.subjects:
        subj_id = subj.id or f"subj_{uuid.uuid4().hex[:12]}"
        folder_id = subj.folder_id
        if not folder_id:
            existing = await db.folders.find_one({"user_id": user.user_id, "name": subj.name, "status": {"$ne": "deleted"}}, {"_id": 0, "folder_id": 1})
            if existing:
                folder_id = existing["folder_id"]
            else:
                folder_id = uuid.uuid4().hex
                await db.folders.insert_one({
                    "folder_id": folder_id,
                    "user_id": user.user_id,
                    "name": subj.name,
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                await write_audit(user.user_id, "FOLDER_CREATED", {"folder_id": folder_id, "name": subj.name}, request.client.host if request.client else "")
        subjects_out.append({"id": subj_id, "name": subj.name, "folder_id": folder_id})

    schedule_out = [s.model_dump() for s in payload.schedule]

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"subjects": subjects_out, "schedule": schedule_out}},
    )
    await write_audit(user.user_id, "EDUCATION_SETTINGS_UPDATED", {"subjects": [s["name"] for s in subjects_out]}, request.client.host if request.client else "")
    return {"subjects": subjects_out, "schedule": schedule_out}


@router.get("/user/education")
async def get_education_settings(user: User = Depends(get_current_user)):
    if user.role == "pelajar" and user.institution_code and user.enrolled_class:
        from services.sync_service import provision_student_by_class
        try:
            await provision_student_by_class(user.user_id, user.institution_code, user.enrolled_class)
        except Exception as e:
            logger.warning(f"Gagal melakukan auto-provision pelajar institusi: {e}")

    doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "subjects": 1, "schedule": 1, "education_level": 1, "major": 1, "current_semester": 1, "institution": 1})
    if not doc:
        raise HTTPException(404, "User tidak ditemukan")
    subjects = doc.get("subjects") or []
    needs_save = False
    for subj in subjects:
        if not subj.get("id"):
            subj["id"] = f"subj_{uuid.uuid4().hex[:12]}"
            needs_save = True
    if needs_save:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"subjects": subjects}},
        )
    return {
        "subjects": subjects,
        "schedule": doc.get("schedule") or [],
        "education_level": doc.get("education_level"),
        "major": doc.get("major"),
        "current_semester": user.effective_grade,
        "institution": doc.get("institution"),
    }


@router.post("/user/education/generate")
async def generate_material(payload: MaterialGeneratePayload, request: Request, user: User = Depends(get_current_user)):
    if not payload.subject_name.strip():
        raise HTTPException(400, "Nama mapel wajib")

    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(404, "User tidak ditemukan")

    level = user_doc.get("education_level", "Umum")
    grade = user.effective_grade or ""
    major = user_doc.get("major", "")
    institution = user_doc.get("institution", "")
    personality = user_doc.get("personality") or {}
    learning_style = personality.get("learning_style", "umum")

    subj_data = None
    for s in (user_doc.get("subjects") or []):
        if s.get("id") == payload.subject_id:
            subj_data = s
            break
    if not subj_data:
        raise HTTPException(404, "Mapel tidak ditemukan di profil kamu")

    folder_id = subj_data.get("folder_id")
    topic = payload.topic or payload.subject_name

    audience = _audience(user)

    # Sesuaikan instruksi prompt berdasarkan gaya belajar siswa
    style_instruction = ""
    if learning_style == "visual":
        style_instruction = (
            "Karena siswa memiliki gaya belajar VISUAL, buat ringkasan yang kaya dengan analogi bentuk/diagram, "
            "dan gunakan struktur tabel teks atau diagram konsep yang mudah digambarkan secara visual."
        )
    elif learning_style == "auditory":
        style_instruction = (
            "Karena siswa memiliki gaya belajar AUDITORI, gunakan penjelasan lisan bergaya dialog/storytelling "
            "dan sertakan skenario tanya-jawab verbal singkat di akhir penjelasan materi."
        )
    elif learning_style == "kinesthetic":
        style_instruction = (
            "Karena siswa memiliki gaya belajar KINESTETIK, sertakan 1 panduan aktivitas praktik mandiri "
            "atau eksperimen sederhana (studi kasus nyata) di bagian study_notes agar siswa bisa langsung mempraktekkannya."
        )
    else:
        style_instruction = "Gunakan penjelasan teks yang detail dan terstruktur logis."

    system = (
        f"Kamu adalah asisten pembelajaran untuk {audience}. "
        f"Buat materi belajar tentang {topic} untuk {level}, kelas {grade}"
        + (f", jurusan {major}" if major else "")
        + (f", {institution}" if institution else "") + ". "
        f"{style_instruction} "
        f"Gunakan bahasa Indonesia. Format output sebagai JSON dengan keys: "
        f"title (string), summary (string, 2-3 paragraf), key_concepts (array of {{concept, explanation}}), "
        f"study_notes (string, penjelasan detail poin-poin penting), "
        f"practice_questions (array of {{question, options (array of 4), correct_index, explanation}})."
    )
    prompt = (
        f"Buat materi belajar tentang {topic} untuk {level} kelas {grade}"
        + (f" jurusan {major}" if major else "") + ". "
        f"Topik ini adalah bagian dari mata pelajaran {payload.subject_name}. "
        f"Buat materi yang sesuai dengan kurikulum Indonesia. "
        f"Sertakan ringkasan, konsep kunci, catatan belajar, dan 3 soal latihan."
    )

    try:
        resp = await _call_groq(system, prompt)
    except Exception as e:
        raise HTTPException(500, f"Gagal generate materi: {str(e)[:200]}")

    import json as _json
    import re as _re
    match = _re.search(r'\{.*\}', resp, _re.DOTALL)
    if match:
        try:
            data = _json.loads(match.group())
        except:
            data = {"title": f"Materi {topic}", "summary": resp, "key_concepts": [], "study_notes": "", "practice_questions": []}
    else:
        data = {"title": f"Materi {topic}", "summary": resp, "key_concepts": [], "study_notes": "", "practice_questions": []}

    material_id = uuid.uuid4().hex
    title = data.get("title", f"Materi {topic}")

    material = {
        "material_id": material_id,
        "user_id": user.user_id,
        "subject_id": payload.subject_id,
        "subject_name": payload.subject_name,
        "folder_id": folder_id,
        "topic": topic,
        "title": title,
        "summary": data.get("summary", ""),
        "key_concepts": data.get("key_concepts", []),
        "study_notes": data.get("study_notes", ""),
        "practice_questions": data.get("practice_questions", []),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.study_materials.insert_one(material.copy())

    await db.documents.insert_one({
        "document_id": material_id,
        "user_id": user.user_id,
        "filename": f"Materi - {title}.md",
        "title": title,
        "folder_id": folder_id,
        "subject_id": payload.subject_id,
        "subject_name": payload.subject_name,
        "ai_generated": True,
        "ai_content": data,
        "summary": data.get("summary", ""),
        "key_concepts": data.get("key_concepts", []),
        "status": "ready",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await write_audit(user.user_id, "MATERIAL_GENERATED", {"material_id": material_id, "subject": payload.subject_name, "topic": topic}, request.client.host if request.client else "")
    material.pop("_id", None)
    return material


@router.get("/user/education/materials")
async def list_materials(user: User = Depends(get_current_user)):
    materials = await db.study_materials.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"materials": materials}


@router.get("/user/education/materials/{material_id}")
async def get_material(material_id: str, user: User = Depends(get_current_user)):
    m = await db.study_materials.find_one({"material_id": material_id, "user_id": user.user_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    return m


@router.delete("/user/education/materials/{material_id}")
async def delete_material(material_id: str, request: Request, user: User = Depends(get_current_user)):
    m = await db.study_materials.find_one({"material_id": material_id, "user_id": user.user_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    await db.study_materials.delete_one({"material_id": material_id, "user_id": user.user_id})
    await db.documents.delete_one({"document_id": material_id, "user_id": user.user_id, "ai_generated": True})
    await write_audit(user.user_id, "MATERIAL_DELETED", {"material_id": material_id}, request.client.host if request.client else "")
    return {"deleted": True}


@router.post("/documents/upload")
async def upload_document(request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    # RBAC: Institutional students are blocked from manual uploads
    if user.role == UserRole.pelajar and user.institution_code:
        raise HTTPException(403, "Pelajar institusi tidak dapat mengunggah dokumen secara mandiri.")

    if not file.filename:
        raise HTTPException(400, "File tidak valid")

    ext = os.path.splitext(file.filename)[1].lower()
    is_image = file.content_type in ALLOWED_IMAGE_TYPES or ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp")
    is_pdf = ext == ".pdf" or file.content_type == "application/pdf"
    if not is_image and not is_pdf:
        raise HTTPException(400, "Format tidak didukung. Gunakan PDF atau gambar (JPG/PNG/WEBP/BMP).")

    content_length = request.headers.get("content-length")
    if content_length:
        total_bytes = int(content_length)
        if total_bytes > MAX_UPLOAD_BYTES:
            max_mb = round(MAX_UPLOAD_BYTES / (1024 * 1024), 1)
            raise HTTPException(413, f"File terlalu besar. Maksimal {max_mb}MB. Content-Length: {total_bytes} bytes.")

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
        _ensure_within_upload_limit(len(pdf_bytes), f"{file.filename} (setelah konversi)")
    else:
        pdf_bytes = await file.read()
        _ensure_within_upload_limit(len(pdf_bytes), file.filename)

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

    if not await enqueue_storage_upload(user.user_id, doc_id, str(saved_path)):
        asyncio.create_task(try_upload_supabase(user.user_id, doc_id, str(saved_path)))

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
        "processing_stage": "analysis",
        "hobby_status": "idle",
        "hobby_output_ready": False,
        "skip_hobby_personalization": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(base.copy())
    ip = request.client.host if request.client else ""
    await write_audit(user.user_id, "DOCUMENT_UPLOAD", {"document_id": doc_id, "filename": file.filename}, ip)
    await _emit_document_status(user.user_id, doc_id, "processing", filename=file.filename, stage="analysis")

    if not await enqueue_document_analyze(doc_id, str(saved_path), user, ip):
        asyncio.create_task(run_analysis_queued(doc_id, str(saved_path), user, ip))

    doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
    return JSONResponse(status_code=200, content=doc)


@router.post("/documents/upload-subject-material/{subject_id}")
async def upload_subject_material(
    request: Request,
    subject_id: str,
    files: List[UploadFile] = File(...),
    user: User = Depends(require_pengajar),
):
    # This route is specifically for institutional materials, so we use require_pengajar
    if not files or len(files) == 0:
        raise HTTPException(400, "Pilih minimal 1 file")

    content_length = request.headers.get("content-length")
    if content_length:
        total_bytes = int(content_length)
        if total_bytes > MAX_UPLOAD_BYTES * len(files):
            max_mb = round(MAX_UPLOAD_BYTES / (1024 * 1024), 1)
            raise HTTPException(413, f"Total upload terlalu besar. Maksimal {max_mb}MB per file.")

    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "subjects": 1})
    if not user_doc:
        raise HTTPException(404, "User tidak ditemukan")

    subj = None
    for s in (user_doc.get("subjects") or []):
        if s.get("id") == subject_id:
            subj = s
            break
    if not subj:
        raise HTTPException(404, "Mapel tidak ditemukan di profil kamu")

    folder_id = subj.get("folder_id")
    created = []
    ip = request.client.host if request.client else ""

    for file in files:
        if not file.filename:
            continue
        ext = os.path.splitext(file.filename)[1].lower()
        is_image = file.content_type in ALLOWED_IMAGE_TYPES or ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp")
        is_pdf = ext == ".pdf" or file.content_type == "application/pdf"

        if not is_image and not is_pdf:
            raise HTTPException(400, f"Format {file.filename} tidak didukung. Gunakan PDF atau gambar (JPG/PNG).")

        doc_id = uuid.uuid4().hex

        if is_image:
            if not PIL_AVAILABLE:
                raise HTTPException(400, "Konversi gambar ke PDF tidak tersedia di server ini.")
            try:
                contents = await file.read()
                _ensure_within_upload_limit(len(contents), file.filename)
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

        _ensure_within_upload_limit(len(pdf_bytes), f"{file.filename} (setelah konversi)")

        saved_path = UPLOAD_DIR / f"{doc_id}.pdf"
        with saved_path.open("wb") as f:
            f.write(pdf_bytes)

        try:
            await db.pdf_files.insert_one({
                "document_id": doc_id,
                "user_id": user.user_id,
                "data": Binary(pdf_bytes),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass

        if not await enqueue_storage_upload(user.user_id, doc_id, str(saved_path)):
            asyncio.create_task(try_upload_supabase(user.user_id, doc_id, str(saved_path)))

        source_label = file.filename or (f"Foto_{doc_id[:8]}.png" if is_image else f"Dokumen_{doc_id[:8]}.pdf")
        base = {
            "document_id": doc_id,
            "user_id": user.user_id,
            "filename": source_label,
            "title": source_label,
            "file_path": str(saved_path),
            "folder_id": folder_id,
            "summary": "",
            "key_concepts": [],
            "diagrams": [],
            "learning_objectives": [],
            "subject_id": subject_id,
            "subject_name": subj.get("name", ""),
            "status": "processing",
            "processing_stage": "analysis",
            "hobby_status": "idle",
            "hobby_output_ready": False,
            "skip_hobby_personalization": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.documents.insert_one(base.copy())
        await write_audit(user.user_id, "SUBJECT_MATERIAL_UPLOAD", {
            "document_id": doc_id,
            "filename": source_label,
            "subject_id": subject_id,
            "subject_name": subj.get("name", ""),
        }, ip)
        await _emit_document_status(user.user_id, doc_id, "processing", filename=source_label, stage="analysis")

        if not await enqueue_document_analyze(doc_id, str(saved_path), user, ip):
            asyncio.create_task(run_analysis_queued(doc_id, str(saved_path), user, ip))

        doc_view = base.copy()
        doc_view.pop("file_path", None)
        created.append(doc_view)

    return JSONResponse(status_code=200, content={"documents": created, "subject_id": subject_id, "subject_name": subj.get("name", "")})


@router.get("/documents")
async def list_documents(user: User = Depends(get_current_user)):
    docs = await db.documents.find({"user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(100)
    
    if user.role == UserRole.pelajar:
        if user.institution_code and user.enrolled_class:
            from services.sync_service import provision_student_by_class
            try:
                await provision_student_by_class(user.user_id, user.institution_code, user.enrolled_class)
                fresh_user = await db.users.find_one({"user_id": user.user_id})
                if fresh_user:
                    user.subjects = fresh_user.get("subjects") or []
            except Exception as e:
                logger.warning(f"Gagal melakukan auto-provision pelajar di list_documents: {e}")

        subjects = user.subjects or []
        subject_names = [s.get("name") for s in subjects if s.get("name")]
        
        inst_docs = []
        if user.institution_code:
            inst_docs = await db.documents.find({
                "institution_code": user.institution_code,
                "subject_name": {"$in": subject_names},
                "visibility": "institution",
                "status": "published"
            }, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(100)
        elif user.class_token_used:
            token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
            if token_doc:
                inst_docs = await db.documents.find({
                    "user_id": token_doc["created_by_user_id"],
                    "$or": [
                        {"target_class_room": token_doc["target_class_room"]},
                        {"target_class_rooms": token_doc["target_class_room"]}
                    ],
                    "subject_name": {"$in": subject_names},
                    "status": "published"
                }, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(100)
        
        if inst_docs:
            name_to_folder = {s["name"].strip().lower(): s.get("folder_id") for s in subjects if s.get("name")}
            name_to_subject_id = {s["name"].strip().lower(): s.get("id") for s in subjects if s.get("name")}
            for doc in inst_docs:
                subj_name = doc.get("subject_name", "")
                subj_lower = subj_name.strip().lower()
                doc["folder_id"] = name_to_folder.get(subj_lower)
                doc["subject_id"] = name_to_subject_id.get(subj_lower)
                
            docs.extend(inst_docs)
            docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            
            seen = set()
            unique_docs = []
            for d in docs:
                d_id = d.get("document_id")
                if d_id not in seen:
                    seen.add(d_id)
                    unique_docs.append(d)
            docs = unique_docs[:100]

    personalized_ready_ids = None
    hobby = _normalize_hobby(user.hobby)
    if user.role == UserRole.pelajar and hobby and hobby not in ("none", "musik"):
        own_doc_ids = [d["document_id"] for d in docs if d.get("user_id") == user.user_id]
        if own_doc_ids:
            cached = await db.personalized_documents.find(
                {"user_id": user.user_id, "hobby": hobby, "document_id": {"$in": own_doc_ids}},
                {"_id": 0, "document_id": 1},
            ).to_list(len(own_doc_ids))
            personalized_ready_ids = {row["document_id"] for row in cached}

    docs = [_apply_document_pipeline_defaults(d, user, personalized_ready_ids) for d in docs]
    return docs


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0, "file_path": 0})
    if not doc:
        if user.role == "pelajar":
            if user.institution_code:
                doc = await db.documents.find_one({
                    "document_id": doc_id,
                    "institution_code": user.institution_code,
                    "visibility": "institution",
                    "status": "published"
                }, {"_id": 0, "file_path": 0})
            elif user.class_token_used:
                token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
                if token_doc:
                    doc = await db.documents.find_one({
                        "document_id": doc_id,
                        "user_id": token_doc["created_by_user_id"],
                        "$or": [
                            {"target_class_room": token_doc["target_class_room"]},
                            {"target_class_rooms": token_doc["target_class_room"]}
                        ],
                        "status": "published"
                    }, {"_id": 0, "file_path": 0})
            if doc:
                subjects = user.subjects or []
                subj_name = doc.get("subject_name", "")
                subj_lower = subj_name.strip().lower()
                for s in subjects:
                    if s.get("name") and s["name"].strip().lower() == subj_lower:
                        doc["folder_id"] = s.get("folder_id")
                        doc["subject_id"] = s.get("id")
                        break
        elif user.role == "pengajar" and user.institution_code:
            doc = await db.documents.find_one({
                "document_id": doc_id,
                "institution_code": user.institution_code
            }, {"_id": 0, "file_path": 0})
            
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")

    if user.role == "pelajar" and user.hobby == "musik" and not doc.get("skip_hobby_personalization"):
        genre = (user.music_genre or "pop, romantic").strip()
        music_summaries = doc.get("music_summaries", {})
        if genre not in music_summaries:
            summary_text = doc.get("summary", "")
            if summary_text:
                try:
                    res = await aimusic_minimax(summary_text, genre)
                    music_summaries[genre] = res
                    await db.documents.update_one(
                        {"document_id": doc_id},
                        {"$set": {"music_summaries": music_summaries, "hobby_status": "ready", "hobby_output_ready": True}}
                    )
                    doc["music_summaries"] = music_summaries
                except Exception as e:
                    logger.warning(f"Gagal melakukan personalisasi musik untuk genre {genre}: {e}")

    elif user.role == "pelajar" and user.hobby and user.hobby not in ("none", "musik", "") and not doc.get("skip_hobby_personalization"):
        cache = await db.personalized_documents.find_one({
            "document_id": doc_id,
            "user_id": user.user_id,
            "hobby": user.hobby
        })
        if cache:
            doc["summary"] = cache.get("summary", doc.get("summary"))
            doc["key_concepts"] = cache.get("key_concepts", doc.get("key_concepts"))
            doc["hobby_status"] = "ready"
            doc["hobby_output_ready"] = True
        else:
            try:
                pers = await personalize_document_for_student(doc, user.hobby)
                if pers:
                    doc["summary"] = pers["summary"]
                    doc["key_concepts"] = pers["key_concepts"]
                    doc["hobby_status"] = "ready"
                    doc["hobby_output_ready"] = True
                    await db.personalized_documents.insert_one({
                        "document_id": doc_id,
                        "user_id": user.user_id,
                        "hobby": user.hobby,
                        "summary": pers["summary"],
                        "key_concepts": pers["key_concepts"],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    await db.documents.update_one(
                        {"document_id": doc_id},
                        {"$set": {"hobby_status": "ready", "hobby_output_ready": True}},
                    )
            except Exception as e:
                logger.warning(f"Gagal personalisasi untuk hobi {user.hobby}: {e}")

    return _apply_document_pipeline_defaults(doc, user)


@router.post("/documents/{doc_id}/cancel")
async def cancel_document(request: Request, doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if doc.get("status") != "processing":
        raise HTTPException(400, "Dokumen tidak sedang diproses")
    if doc.get("summary"):
        await db.documents.update_one(
            {"document_id": doc_id},
            {
                "$set": {
                    "status": "ready",
                    "processing_stage": None,
                    "hobby_status": "cancelled",
                    "hobby_output_ready": False,
                    "skip_hobby_personalization": True,
                }
            },
        )
        await _emit_document_status(user.user_id, doc_id, "ready", stage="summary_only")
        await write_audit(user.user_id, "DOCUMENT_CANCELLED", {"document_id": doc_id}, request.client.host if request.client else "")
        return {"document_id": doc_id, "status": "ready", "message": "Personalisasi hobi dibatalkan, ringkasan tetap tersedia"}
    await db.documents.update_one(
        {"document_id": doc_id},
        {"$set": {"status": "cancelled", "processing_stage": None}},
    )
    await write_audit(user.user_id, "DOCUMENT_CANCELLED", {"document_id": doc_id}, request.client.host if request.client else "")
    await _emit_document_status(user.user_id, doc_id, "cancelled", stage="analysis")
    return {"document_id": doc_id, "status": "cancelled"}


@router.delete("/documents/{doc_id}")
async def delete_document(request: Request, doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")

    now = datetime.now(timezone.utc).isoformat()
    await db.documents.update_one(
        {"document_id": doc_id, "user_id": user.user_id},
        {"$set": {"status": "deleted", "deleted_at": now}},
    )

    fp = doc.get("file_path")
    if fp:
        try:
            Path(fp).unlink(missing_ok=True)
        except Exception:
            logger.warning(f"Gagal hapus file {fp}")

    await delete_from_supabase_storage(user.user_id, doc_id)

    await write_audit(user.user_id, "DOCUMENT_DELETED", {"document_id": doc_id, "filename": doc.get("filename")}, request.client.host if request.client else "")
    await _emit_document_status(user.user_id, doc_id, "deleted")
    return {"document_id": doc_id, "deleted": True, "soft_deleted": True}


@router.post("/documents/{document_id}/tts")
async def document_tts(document_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": document_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        if user.role == "pelajar":
            if user.institution_code:
                doc = await db.documents.find_one({
                    "document_id": document_id,
                    "institution_code": user.institution_code,
                    "visibility": "institution",
                    "status": "published"
                }, {"_id": 0})
            elif user.class_token_used:
                token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
                if token_doc:
                    doc = await db.documents.find_one({
                        "document_id": document_id,
                        "user_id": token_doc["created_by_user_id"],
                        "$or": [
                            {"target_class_room": token_doc["target_class_room"]},
                            {"target_class_rooms": token_doc["target_class_room"]}
                        ],
                        "status": "published"
                    }, {"_id": 0})
        elif user.role == "pengajar" and user.institution_code:
            doc = await db.documents.find_one({
                "document_id": document_id,
                "institution_code": user.institution_code
            }, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    text = (doc.get("summary") or "").strip()
    if not text:
        raise HTTPException(400, "Dokumen belum memiliki ringkasan")
    audio_filename = f"doc_{document_id}.wav"
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
    return {"audio_url": audio_url, "status": "ready"}


@router.get("/documents/{doc_id}/pdf")
async def get_document_pdf(doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        if user.role == "pelajar":
            if user.institution_code:
                doc = await db.documents.find_one({
                    "document_id": doc_id,
                    "institution_code": user.institution_code,
                    "visibility": "institution",
                    "status": "published"
                }, {"_id": 0})
            elif user.class_token_used:
                token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
                if token_doc:
                    doc = await db.documents.find_one({
                        "document_id": doc_id,
                        "user_id": token_doc["created_by_user_id"],
                        "$or": [
                            {"target_class_room": token_doc["target_class_room"]},
                            {"target_class_rooms": token_doc["target_class_room"]}
                        ],
                        "status": "published"
                    }, {"_id": 0})
        elif user.role == "pengajar" and user.institution_code:
            doc = await db.documents.find_one({
                "document_id": doc_id,
                "institution_code": user.institution_code
            }, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")

    stored = await db.pdf_files.find_one({"document_id": doc_id}, {"_id": 0, "data": 1})
    if stored:
        filename = doc.get("filename", "document.pdf")
        return Response(
            content=stored["data"],
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )

    pdf_url = doc.get("pdf_url")
    if pdf_url:
        return {"pdf_url": pdf_url}

    fp = doc.get("file_path")
    if fp and Path(fp).exists():
        return FileResponse(fp, media_type="application/pdf", filename=doc.get("filename", "document.pdf"))

    raise HTTPException(404, "File PDF tidak ditemukan")


@router.post("/documents/move")
async def move_documents(payload: DocumentMove, request: Request, user: User = Depends(get_current_user)):
    # Verify that the folder exists if folder_id is provided
    if payload.folder_id:
        folder = await db.folders.find_one({"folder_id": payload.folder_id, "user_id": user.user_id, "status": {"$ne": "deleted"}})
        if not folder:
            raise HTTPException(404, "Folder tidak ditemukan")
    
    result = await db.documents.update_many(
        {"document_id": {"$in": payload.document_ids}, "user_id": user.user_id},
        {"$set": {"folder_id": payload.folder_id}}
    )
    
    await write_audit(user.user_id, "DOCUMENTS_MOVED", {"document_ids": payload.document_ids, "folder_id": payload.folder_id}, request.client.host if request.client else "")
    return {"moved": result.matched_count, "folder_id": payload.folder_id}


@router.get("/documents/jobs")
async def list_document_jobs(user: User = Depends(get_current_user)):
    """
    Mengambil daftar dokumen yang sedang dalam proses analisis (status: processing).
    """
    jobs = await db.documents.find(
        {"user_id": user.user_id, "status": "processing"},
        {"_id": 0, "document_id": 1, "filename": 1, "status": 1, "created_at": 1}
    ).to_list(50)
    
    return {"jobs": jobs}


from pydantic import BaseModel

class MusicSummaryPayload(BaseModel):
    tags: Optional[str] = "pop, romantic"

@router.post("/documents/{doc_id}/music-summary")
async def get_or_create_music_summary(
    doc_id: str,
    payload: MusicSummaryPayload,
    user: User = Depends(get_current_user)
):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        if user.role == "pelajar":
            if user.institution_code:
                doc = await db.documents.find_one({
                    "document_id": doc_id,
                    "institution_code": user.institution_code,
                    "visibility": "institution",
                    "status": "published"
                }, {"_id": 0})
            elif user.class_token_used:
                token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
                if token_doc:
                    doc = await db.documents.find_one({
                        "document_id": doc_id,
                        "user_id": token_doc["created_by_user_id"],
                        "$or": [
                            {"target_class_room": token_doc["target_class_room"]},
                            {"target_class_rooms": token_doc["target_class_room"]}
                        ],
                        "status": "published"
                    }, {"_id": 0})
        elif user.role == "pengajar" and user.institution_code:
            doc = await db.documents.find_one({
                "document_id": doc_id,
                "institution_code": user.institution_code
            }, {"_id": 0})
            
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
        
    tags = (payload.tags or "pop, romantic").strip()
    
    music_summaries = doc.get("music_summaries", {})
    # Skip cache — always regenerate with Suno engine for proper vocals
    summary_text = doc.get("summary", "")
    if not summary_text:
        raise HTTPException(400, "Dokumen ini belum memiliki ringkasan untuk diubah menjadi musik")
        
    is_own = doc.get("user_id") == user.user_id
    if is_own:
        await db.documents.update_one(
            {"document_id": doc_id},
            {
                "$set": {
                    "status": "processing",
                    "processing_stage": "hobby",
                    "hobby_status": "processing",
                    "hobby_output_ready": False,
                    "skip_hobby_personalization": False,
                }
            }
        )
        await _emit_document_status(user.user_id, doc_id, "processing", stage="hobby")

    try:
        res = await aimusic_minimax(summary_text, tags)
        music_summaries[tags] = res
        update = {
            "music_summaries": music_summaries,
            "hobby_status": "ready",
            "hobby_output_ready": True,
        }
        if is_own:
            update.update({
                "status": "ready",
                "processing_stage": None,
                "skip_hobby_personalization": False,
            })
        await db.documents.update_one({"document_id": doc_id}, {"$set": update})
        if is_own:
            await _emit_document_status(user.user_id, doc_id, "ready", stage="completed")
        return res
    except Exception as e:
        if is_own:
            await db.documents.update_one(
                {"document_id": doc_id},
                {"$set": {"status": "ready", "processing_stage": None}}
            )
            await _emit_document_status(user.user_id, doc_id, "ready", stage="summary_only")
        logger.exception("Gagal generate music summary")
        raise HTTPException(500, f"Gagal membuat aransemen musik: {str(e)}")
