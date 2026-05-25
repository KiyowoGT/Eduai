import csv
import io
import logging
import uuid
import httpx
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel

from core.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
from core.database import db
from models.user import User, TeacherTitle
from deps.auth import get_current_user, require_pengajar, write_audit

logger = logging.getLogger(__name__)
router = APIRouter()

COLUMN_ALIASES = {
    "nama": ["nama", "name", "full name", "full_name", "nama lengkap", "student name", "nama siswa"],
    "nisn": ["nisn", "nis", "nomor induk", "no induk"],
    "tahun_masuk": ["tahun masuk", "tahun", "year", "entry year", "tahun_masuk", "angkatan"],
    "kelas": ["kelas", "class", "class name", "kelas tujuan", "target class", "enrolled_class"],
}

def detect_column(headers):
    mapping = {}
    for h in headers:
        hl = h.strip().lower()
        for key, aliases in COLUMN_ALIASES.items():
            if hl in aliases:
                mapping[key] = h
                break
    return mapping

def sanitize_institution_code(code):
    return "".join(c for c in code if c.isalnum()).upper()[:10]

def build_email(nisn, inst_code):
    return f"{nisn}@s.{sanitize_institution_code(inst_code)}.sch.id"

def build_password(inst_name, tahun_masuk):
    name_clean = "".join(c for c in inst_name if c.isalnum() or c in "._-").upper()[:8]
    return f"{name_clean}{tahun_masuk}"


class CreateStudentPayload(BaseModel):
    name: str
    nisn: str
    nis: Optional[str] = None
    enrolled_class: str
    tahun_masuk: int


@router.post("/teacher/students")
async def create_student(
    payload: CreateStudentPayload,
    request: Request,
    user: User = Depends(require_pengajar)
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    nisn = payload.nisn.strip()
    email = build_email(nisn, user.institution_code)

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, f"Siswa dengan NISN {nisn} sudah terdaftar")

    inst = await db.institutions.find_one({"institution_code": user.institution_code})
    inst_name = inst.get("name", "") if inst else ""
    password = build_password(inst_name, str(payload.tahun_masuk))

    active_year = await db.academic_years.find_one(
        {"institution_code": user.institution_code, "is_active": True}
    )

    supa_user_id = None
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as hc:
                r = await hc.post(
                    f"{SUPABASE_URL}/auth/v1/admin/users",
                    headers={
                        "apikey": SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "email": email,
                        "password": password,
                        "email_confirm": True,
                        "user_metadata": {
                            "full_name": payload.name,
                            "name": payload.name,
                            "nisn": nisn,
                            "role": "pelajar",
                            "created_by_admin": True,
                        }
                    }
                )
            if r.status_code in (200, 201):
                supa_data = r.json()
                supa_user_id = supa_data.get("id") or supa_data.get("user", {}).get("id")
            else:
                raise HTTPException(400, f"Gagal membuat akun auth: {r.text[:200]}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Gagal sinkronisasi auth: {e}")

    student_id = supa_user_id or f"STU-{uuid.uuid4().hex[:8].upper()}"
    doc = {
        "user_id": student_id,
        "email": email,
        "name": payload.name.strip(),
        "role": "pelajar",
        "account_type": "perusahaan",
        "onboarded": True,
        "institution_code": user.institution_code,
        "institution": inst_name,
        "education_level": user.education_level,
        "enrolled_class": payload.enrolled_class.strip(),
        "nis": payload.nis.strip() if payload.nis else nisn,
        "nisn": nisn,
        "tahun_masuk": payload.tahun_masuk,
        "username": nisn,
        "current_semester": payload.tahun_masuk,
        "subjects": [],
        "schedule": [],
        "class_token_used": None,
        "academic_year_id": active_year["academic_year_id"] if active_year else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(doc)
    await write_audit(
        user.user_id,
        "STUDENT_CREATED",
        {"student_user_id": student_id, "name": payload.name, "class": payload.enrolled_class},
        request.client.host if request.client else ""
    )

    return {"status": "success", "user_id": student_id, "email": email}


@router.put("/teacher/students/{student_id}")
async def update_student(
    student_id: str,
    payload: CreateStudentPayload,
    request: Request,
    user: User = Depends(require_pengajar)
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    student = await db.users.find_one({
        "user_id": student_id,
        "institution_code": user.institution_code,
        "role": "pelajar"
    })
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    updates = {
        "name": payload.name.strip(),
        "enrolled_class": payload.enrolled_class.strip(),
        "nis": payload.nis.strip() if payload.nis else payload.nisn.strip(),
        "tahun_masuk": payload.tahun_masuk,
    }

    await db.users.update_one({"user_id": student_id}, {"$set": updates})
    await write_audit(
        user.user_id,
        "STUDENT_UPDATED",
        {"student_user_id": student_id, "updates": list(updates.keys())},
        request.client.host if request.client else ""
    )

    return {"status": "success"}


@router.delete("/teacher/students/{student_id}")
async def delete_student(
    student_id: str,
    request: Request,
    user: User = Depends(require_pengajar)
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    student = await db.users.find_one({
        "user_id": student_id,
        "institution_code": user.institution_code,
        "role": "pelajar"
    })
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as hc:
                await hc.delete(
                    f"{SUPABASE_URL}/auth/v1/admin/users/{student_id}",
                    headers={
                        "apikey": SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    }
                )
        except Exception as e:
            logger.warning(f"Gagal hapus auth Supabase: {e}")

    await db.users.delete_one({"user_id": student_id})
    await write_audit(
        user.user_id,
        "STUDENT_DELETED",
        {"student_user_id": student_id, "name": student.get("name")},
        request.client.host if request.client else ""
    )

    return {"status": "deleted"}


@router.post("/teacher/students/upload")
async def upload_students_csv(
    file: UploadFile = File(...),
    request: Request = None,
    user: User = Depends(require_pengajar)
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    contents = await file.read()
    decoded = contents.decode("utf-8-sig").splitlines()
    reader = csv.DictReader(decoded)
    if not reader.fieldnames:
        raise HTTPException(400, "CSV tidak memiliki header")

    mapping = detect_column(reader.fieldnames)
    missing = [k for k in ("nama", "nisn", "tahun_masuk", "kelas") if k not in mapping]
    if missing:
        raise HTTPException(400, f"Kolom wajib tidak ditemukan di CSV: {', '.join(missing)}. Header ditemukan: {', '.join(reader.fieldnames)}")

    inst = await db.institutions.find_one({"institution_code": user.institution_code})
    inst_name = inst.get("name", "") if inst else ""

    active_year = await db.academic_years.find_one(
        {"institution_code": user.institution_code, "is_active": True}
    )

    results = {"success": [], "failed": []}

    for row_num, row in enumerate(reader, start=2):
        try:
            name = row[mapping["nama"]].strip()
            nisn = row[mapping["nisn"]].strip()
            kelas = row[mapping["kelas"]].strip()
            tahun_raw = row[mapping["tahun_masuk"]].strip()
            tahun_masuk = int(tahun_raw)

            if not name or not nisn or not kelas:
                results["failed"].append({"row": row_num, "reason": "Data tidak lengkap", "nisn": nisn})
                continue

            email = build_email(nisn, user.institution_code)
            existing = await db.users.find_one({"email": email})
            if existing:
                results["failed"].append({"row": row_num, "reason": f"NISN {nisn} sudah terdaftar", "nisn": nisn})
                continue

            password = build_password(inst_name, str(tahun_masuk))

            supa_user_id = None
            if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as hc:
                        r = await hc.post(
                            f"{SUPABASE_URL}/auth/v1/admin/users",
                            headers={
                                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "email": email,
                                "password": password,
                                "email_confirm": True,
                                "user_metadata": {
                                    "full_name": name,
                                    "name": name,
                                    "nisn": nisn,
                                    "role": "pelajar",
                                    "created_by_admin": True,
                                }
                            }
                        )
                    if r.status_code in (200, 201):
                        supa_data = r.json()
                        supa_user_id = supa_data.get("id") or supa_data.get("user", {}).get("id")
                    else:
                        results["failed"].append({"row": row_num, "reason": f"Auth gagal: {r.text[:100]}", "nisn": nisn})
                        continue
                except Exception as e:
                    results["failed"].append({"row": row_num, "reason": f"Auth error: {str(e)[:100]}", "nisn": nisn})
                    continue

            student_id = supa_user_id or f"STU-{uuid.uuid4().hex[:8].upper()}"
            doc = {
                "user_id": student_id,
                "email": email,
                "name": name,
                "role": "pelajar",
                "account_type": "perusahaan",
                "onboarded": True,
                "institution_code": user.institution_code,
                "institution": inst_name,
                "education_level": user.education_level,
                "enrolled_class": kelas,
                "nis": nisn,
                "nisn": nisn,
                "tahun_masuk": tahun_masuk,
                "username": nisn,
                "current_semester": tahun_masuk,
                "subjects": [],
                "schedule": [],
                "class_token_used": None,
                "academic_year_id": active_year["academic_year_id"] if active_year else None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            await db.users.insert_one(doc)
            results["success"].append({"row": row_num, "name": name, "nisn": nisn, "email": email})

        except Exception as e:
            results["failed"].append({"row": row_num, "reason": str(e)[:200], "nisn": row.get(mapping.get("nisn", ""), "?")})

    await write_audit(
        user.user_id,
        "STUDENTS_BULK_CREATED",
        {"total_success": len(results["success"]), "total_failed": len(results["failed"])},
        request.client.host if request.client else ""
    )

    return {
        "status": "completed",
        "total": len(results["success"]) + len(results["failed"]),
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "results": results
    }
