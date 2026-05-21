import io
import os
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from pathlib import Path
from bson import Binary
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None

from core.database import db
from core.config import UPLOAD_DIR, AUDIO_DIR, SUPABASE_URL, SUPABASE_ANON_KEY, MAX_UPLOAD_BYTES, API_PREFIX
from models.user import User, SubjectItem, ScheduleItem, EducationSettingsPayload
from models.document import MaterialGeneratePayload, DocumentMove
from deps.auth import get_current_user, write_audit
from services.ai_service import (
    _audience,
    _call_groq,
    run_analysis_queued,
    _emit_document_status
)
from services.tts_service import _generate_tts

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
SUPABASE_STORAGE_URL = f"{SUPABASE_URL}/storage/v1" if SUPABASE_URL else ""

def _ensure_within_upload_limit(size_bytes: int, filename: str):
    if size_bytes > MAX_UPLOAD_BYTES:
        max_mb = round(MAX_UPLOAD_BYTES / (1024 * 1024), 1)
        raise HTTPException(413, f"Ukuran file {filename} melebihi batas {max_mb} MB")

async def _upload_to_supabase_storage(user_id: str, document_id: str, file_path: str) -> Optional[str]:
    if not SUPABASE_STORAGE_URL:
        return None
    storage_path = f"{user_id}/{document_id}.pdf"
    try:
        with open(file_path, "rb") as f:
            content = f.read()
        async with httpx.AsyncClient(timeout=30.0) as hc:
            r = await hc.post(
                f"{SUPABASE_STORAGE_URL}/object/pdf/{storage_path}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "Content-Type": "application/pdf",
                },
                content=content,
            )
            if r.status_code not in (200, 201):
                logger.warning(f"Supabase storage upload failed: {r.status_code} {r.text[:200]}")
                return None
        return f"{SUPABASE_STORAGE_URL}/object/public/pdf/{storage_path}"
    except Exception as e:
        logger.warning(f"Supabase storage upload error: {e}")
        return None

async def _delete_from_supabase_storage(user_id: str, document_id: str):
    if not SUPABASE_STORAGE_URL:
        return
    storage_path = f"{user_id}/{document_id}.pdf"
    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            await hc.delete(
                f"{SUPABASE_STORAGE_URL}/object/pdf/{storage_path}",
                headers={"Authorization": f"Bearer {SUPABASE_ANON_KEY}"},
            )
    except Exception as e:
        logger.warning(f"Supabase storage delete error: {e}")

async def _try_upload_supabase(user_id: str, doc_id: str, file_path: str):
    """Non-blocking upload to Supabase Storage. Failures are logged only."""
    try:
        url = await _upload_to_supabase_storage(user_id, doc_id, file_path)
        if url:
            await db.documents.update_one(
                {"document_id": doc_id},
                {"$set": {"pdf_url": url}},
            )
    except Exception as e:
        logger.warning(f"Supabase background upload skipped: {e}")


@router.put("/user/education")
async def save_education_settings(payload: EducationSettingsPayload, request: Request, user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(404, "User tidak ditemukan")

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
        "current_semester": doc.get("current_semester"),
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
    grade = user_doc.get("current_semester", "")
    major = user_doc.get("major", "")
    institution = user_doc.get("institution", "")

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

    system = (
        f"Kamu adalah asisten pembelajaran untuk {audience}. "
        f"Buat materi belajar tentang {topic} untuk {level}, kelas {grade}"
        + (f", jurusan {major}" if major else "")
        + (f", {institution}" if institution else "") + ". "
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

    asyncio.create_task(_try_upload_supabase(user.user_id, doc_id, str(saved_path)))

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
    await _emit_document_status(user.user_id, doc_id, "processing", filename=file.filename)

    asyncio.create_task(run_analysis_queued(doc_id, str(saved_path), user, ip))

    doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "file_path": 0})
    return JSONResponse(status_code=200, content=doc)


@router.post("/documents/upload-subject-material/{subject_id}")
async def upload_subject_material(
    request: Request,
    subject_id: str,
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
):
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

        asyncio.create_task(_try_upload_supabase(user.user_id, doc_id, str(saved_path)))

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
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.documents.insert_one(base.copy())
        await write_audit(user.user_id, "SUBJECT_MATERIAL_UPLOAD", {
            "document_id": doc_id,
            "filename": source_label,
            "subject_id": subject_id,
            "subject_name": subj.get("name", ""),
        }, ip)
        await _emit_document_status(user.user_id, doc_id, "processing", filename=source_label)

        asyncio.create_task(run_analysis_queued(doc_id, str(saved_path), user, ip))

        doc_view = base.copy()
        doc_view.pop("file_path", None)
        created.append(doc_view)

    return JSONResponse(status_code=200, content={"documents": created, "subject_id": subject_id, "subject_name": subj.get("name", "")})


@router.get("/documents")
async def list_documents(user: User = Depends(get_current_user)):
    docs = await db.documents.find({"user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(100)
    return docs


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0, "file_path": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    return doc


@router.post("/documents/{doc_id}/cancel")
async def cancel_document(request: Request, doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Dokumen tidak ditemukan")
    if doc.get("status") != "processing":
        raise HTTPException(400, "Dokumen tidak sedang diproses")
    await db.documents.update_one({"document_id": doc_id}, {"$set": {"status": "cancelled"}})
    await write_audit(user.user_id, "DOCUMENT_CANCELLED", {"document_id": doc_id}, request.client.host if request.client else "")
    await _emit_document_status(user.user_id, doc_id, "cancelled")
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

    await _delete_from_supabase_storage(user.user_id, doc_id)

    await write_audit(user.user_id, "DOCUMENT_DELETED", {"document_id": doc_id, "filename": doc.get("filename")}, request.client.host if request.client else "")
    await _emit_document_status(user.user_id, doc_id, "deleted")
    return {"document_id": doc_id, "deleted": True, "soft_deleted": True}


@router.post("/documents/{document_id}/tts")
async def document_tts(document_id: str, user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": document_id, "user_id": user.user_id}, {"_id": 0})
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
    
    await db.documents.update_many(
        {"document_id": {"$in": payload.document_ids}, "user_id": user.user_id},
        {"$set": {"folder_id": payload.folder_id}}
    )
    
    await write_audit(user.user_id, "DOCUMENTS_MOVED", {"document_ids": payload.document_ids, "folder_id": payload.folder_id}, request.client.host if request.client else "")
    return {"ok": True}
