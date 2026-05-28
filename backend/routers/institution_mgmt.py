import csv
import io
import logging
import uuid
import httpx
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, Field, model_validator

from core.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
from core.database import db, client
from models.user import User, TeacherTitle
from deps.auth import get_current_user, require_title, write_audit

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateAcademicYearPayload(BaseModel):
    name: str = Field(..., description="Contoh: 2026/2027")
    start_date: str = Field(..., description="Format: YYYY-MM-DD")
    end_date: str = Field(..., description="Format: YYYY-MM-DD")

class ResignPayload(BaseModel):
    email: str

class CreateTeacherPayload(BaseModel):
    name: str
    email: str
    nip: str
    password: str
    title: str
    titles: Optional[List[TeacherTitle]] = None
    assigned_class: Optional[str] = None
    assigned_subject: Optional[str] = None
    teaching_classes: Optional[List[str]] = None
    major: Optional[str] = None

    @model_validator(mode="after")
    def normalize_empty_strings(self):
        if self.assigned_class is not None and self.assigned_class.strip() == "":
            self.assigned_class = None
        if self.assigned_subject is not None and self.assigned_subject.strip() == "":
            self.assigned_subject = None
        if self.major is not None and self.major.strip() == "":
            self.major = None
        return self

class UpdateTeacherPayload(BaseModel):
    name: Optional[str] = None
    nip: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    admin_password: Optional[str] = None
    title: Optional[TeacherTitle] = None
    titles: Optional[List[TeacherTitle]] = None
    assigned_class: Optional[str] = None
    assigned_subject: Optional[str] = None
    teaching_classes: Optional[List[str]] = None
    major: Optional[str] = None

    @model_validator(mode="after")
    def normalize_empty_strings(self):
        if self.assigned_class is not None and self.assigned_class.strip() == "":
            self.assigned_class = None
        if self.assigned_subject is not None and self.assigned_subject.strip() == "":
            self.assigned_subject = None
        if self.major is not None and self.major.strip() == "":
            self.major = None
        return self

class SwitchRolePayload(BaseModel):
    role_type: str
    scope_id: Optional[str] = None

# Helper to execute MongoDB operations in a transaction with standalone fallback
async def run_in_transaction(func, *args, **kwargs):
    if not client:
        return await func(None, *args, **kwargs)
    try:
        async with await client.start_session() as session:
            async with session.start_transaction():
                return await func(session, *args, **kwargs)
    except Exception as e:
        # Check if transaction is not supported (e.g. standalone local Mongo)
        err_msg = str(e)
        if "transaction" in err_msg.lower() or "standalone" in err_msg.lower() or "121" in err_msg.lower() or "OperationFailure" in err_msg:
            logger.warning(f"Transactions not supported by server. Falling back to sequential execution. Error: {e}")
            return await func(None, *args, **kwargs)
        raise

# Asynchronous cascade academic year activation task
async def activate_academic_year_cascade(new_year_id: str, old_year_id: str, institution_code: str):
    logger.info(f"Memulai cascade activation untuk tahun ajaran baru: {new_year_id}, institusi: {institution_code}")
    try:
        # 1. Archive quizzes of previous academic year
        q_res = await db.quizzes.update_many(
            {"institution_code": institution_code, "academic_year_id": old_year_id},
            {"$set": {"status": "archived", "is_locked": True}}
        )
        logger.info(f"Arsip kuis selesai: {q_res.modified_count} kuis diubah statusnya menjadi archived")

        # 2. Archive documents of previous academic year
        d_res = await db.documents.update_many(
            {"institution_code": institution_code, "academic_year_id": old_year_id},
            {"$set": {"status": "archived"}}
        )
        logger.info(f"Arsip dokumen selesai: {d_res.modified_count} dokumen diubah status menjadi archived")

        # 3. Auto-promote students (e.g. "10-A" -> "11-A")
        # Find active classes in the old academic year
        classes = await db.classes.find({"institution_code": institution_code, "academic_year_id": old_year_id}).to_list(200)
        for cls in classes:
            class_name = cls.get("name", "")
            parts = class_name.split("-")
            if parts and parts[0].isdigit():
                level = int(parts[0])
                if level < 12:
                    new_class_name = f"{level+1}-" + "-".join(parts[1:])
                    # Upsert new class for the new academic year
                    new_cls = await db.classes.find_one_and_update(
                        {
                            "name": new_class_name,
                            "academic_year_id": new_year_id,
                            "institution_code": institution_code
                        },
                        {"$setOnInsert": {
                            "name": new_class_name,
                            "academic_year_id": new_year_id,
                            "institution_code": institution_code,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }},
                        upsert=True,
                        return_document=True
                    )
                    # Update students enrolled in this class
                    s_res = await db.users.update_many(
                        {"enrolled_class": class_name, "institution_code": institution_code},
                        {"$set": {"enrolled_class": new_cls["name"]}}
                    )
                    logger.info(f"Promosi kelas {class_name} -> {new_cls['name']}: {s_res.modified_count} siswa dipindahkan")
                else:
                    # Level 12 (SMA/SMK) or higher -> graduate/alumni
                    grad_res = await db.users.update_many(
                        {"enrolled_class": class_name, "institution_code": institution_code},
                        {"$set": {"enrolled_class": "ALUMNI", "status": "archived"}}
                    )
                    logger.info(f"Siswa kelas {class_name} lulus (lulus/alumni): {grad_res.modified_count} siswa")

        # 4. Clear/invalidate analytics cache for the institution
        await db.analytics_cache.delete_many({"institution_code": institution_code})
        logger.info(f"Pembersihan cache analitik selesai untuk institusi: {institution_code}")

    except Exception as e:
        logger.error(f"Error pada cascade academic year activation: {e}", exc_info=True)

# ----------------- ENDPOINTS -----------------

@router.post("/admin/academic-years")
async def create_academic_year(
    payload: CreateAcademicYearPayload,
    request: Request,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    # Generate unique academic year ID
    import uuid
    year_id = f"ACY-{uuid.uuid4().hex[:8].upper()}"

    doc = {
        "academic_year_id": year_id,
        "institution_code": user.institution_code,
        "name": payload.name,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "is_active": False,
        "is_archived": False,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.academic_years.insert_one(doc)
    doc.pop("_id", None)

    await write_audit(
        user.user_id,
        "ACADEMIC_YEAR_CREATED",
        {"academic_year_id": year_id, "name": payload.name},
        request.client.host if request.client else ""
    )

    return {"status": "success", "academic_year": doc}

@router.post("/admin/academic-years/{year_id}/activate")
async def activate_academic_year(
    year_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    target_year = await db.academic_years.find_one({"academic_year_id": year_id, "institution_code": user.institution_code})
    if not target_year:
        raise HTTPException(404, "Tahun ajaran tidak ditemukan")

    if target_year.get("is_active"):
        return {"status": "already_active", "message": "Tahun ajaran ini sudah aktif"}

    # Find currently active year to archive it
    active_year = await db.academic_years.find_one({"is_active": True, "institution_code": user.institution_code})
    old_year_id = active_year.get("academic_year_id") if active_year else None

    # Deactivate all other academic years and archive the old ones
    if old_year_id:
        await db.academic_years.update_one(
            {"academic_year_id": old_year_id},
            {"$set": {"is_active": False, "is_archived": True}}
        )

    await db.academic_years.update_one(
        {"academic_year_id": year_id},
        {"$set": {"is_active": True}}
    )

    # Trigger async cascade background task
    if old_year_id:
        background_tasks.add_task(
            activate_academic_year_cascade,
            new_year_id=year_id,
            old_year_id=old_year_id,
            institution_code=user.institution_code
        )

    await write_audit(
        user.user_id,
        "ACADEMIC_YEAR_ACTIVATED",
        {"activated_year_id": year_id, "previous_year_id": old_year_id},
        request.client.host if request.client else ""
    )

    return {
        "status": "activating",
        "message": "Proses aktivasi tahun ajaran baru dan pengarsipan tahun ajaran lama sedang diproses di background."
    }

@router.get("/admin/academic-years")
async def list_academic_years(
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    years = await db.academic_years.find({"institution_code": user.institution_code}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return years

@router.post("/admin/users/{user_id}/resign")
async def resign_teacher(
    user_id: str,
    payload: ResignPayload,
    request: Request,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    # Locate target teacher
    target_teacher = await db.users.find_one({"user_id": user_id, "institution_code": user.institution_code})
    if not target_teacher:
        raise HTTPException(404, "Guru pengajar tidak ditemukan pada institusi ini")

    original_email = payload.email.strip().lower()
    if target_teacher.get("email").lower() != original_email:
        raise HTTPException(400, "Email pengajar tidak cocok dengan data pendaftaran")

    # Transactional execution block
    async def resign_transaction_block(session):
        # 1. Cek uniqueness archived mapping
        existing = await db.archived_email_mapping.find_one(
            {"original_email": original_email, "is_recycled": False},
            session=session
        )
        if existing:
            raise HTTPException(409, "Email guru ini sedang dalam proses recycling")

        # 2. Generate archived email & update user record to archived
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        archived_email = f"archived_{timestamp}_{original_email}"

        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "email": archived_email,
                "status": "archived",
                "onboarded": False,
                "title": None,
                "is_institution_linked": False,
                "institution_code": None
            }},
            session=session
        )

        # 3. Deactivate role assignments
        await db.role_assignments.update_many(
            {"user_id": user_id, "status": "active"},
            {"$set": {"status": "historical", "end_date": datetime.now(timezone.utc).isoformat()}},
            session=session
        )

        # 4. Insert archived email mapping
        await db.archived_email_mapping.insert_one({
            "original_email": original_email,
            "archived_email": archived_email,
            "user_id": user_id,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "is_recycled": False
        }, session=session)

        return archived_email

    # Run the sanitization using transactions (or sequential fallback)
    archived_email = await run_in_transaction(resign_transaction_block)

    await write_audit(
        user.user_id,
        "TEACHER_RESIGNED_SANITIZED",
        {"resigned_user_id": user_id, "original_email": original_email, "archived_email": archived_email},
        request.client.host if request.client else ""
    )

    return {
        "status": "success",
        "message": f"Akun guru berhasil dinonaktifkan. Email asli {original_email} dibebaskan untuk digunakan kembali.",
        "archived_email": archived_email
    }

@router.post("/admin/student-promotions/preview")
async def preview_student_promotions(
    file: UploadFile = File(...),
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    contents = await file.read()
    decoded = contents.decode('utf-8-sig').splitlines()
    reader = csv.reader(decoded)

    header = next(reader, None)
    if not header:
        raise HTTPException(400, "File CSV kosong")

    # Expect header: [email, new_class] or similar
    promotions = []
    for row in reader:
        if len(row) < 2:
            continue
        identifier = row[0].strip().lower()
        new_class_name = row[1].strip()

        # Find student
        student_doc = await db.users.find_one({
            "email": identifier,
            "institution_code": user.institution_code,
            "role": "pelajar"
        })

        if not student_doc:
            # Try searching by name/NIP if search matches
            student_doc = await db.users.find_one({
                "name": identifier,
                "institution_code": user.institution_code,
                "role": "pelajar"
            })

        if student_doc:
            promotions.append({
                "user_id": student_doc["user_id"],
                "name": student_doc["name"],
                "email": student_doc["email"],
                "current_class": student_doc.get("enrolled_class") or "Belum diatur",
                "proposed_class": new_class_name,
                "status": "Ready"
            })
        else:
            promotions.append({
                "user_id": None,
                "name": identifier,
                "email": identifier,
                "current_class": "Tidak ditemukan",
                "proposed_class": new_class_name,
                "status": "Siswa tidak ditemukan"
            })

    return {"promotions": promotions}

@router.post("/admin/student-promotions/execute")
async def execute_student_promotions(
    promotions: List[dict],
    request: Request,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    success_count = 0
    errors = []

    # Get active academic year id
    active_year = await db.academic_years.find_one({"institution_code": user.institution_code, "is_active": True})
    if not active_year:
        raise HTTPException(404, "Tahun ajaran aktif belum dikonfigurasi. Silakan aktifkan tahun ajaran terlebih dahulu.")
    
    academic_year_id = active_year["academic_year_id"]

    for promo in promotions:
        user_id = promo.get("user_id")
        proposed_class = promo.get("proposed_class")
        if not user_id or not proposed_class:
            continue

        try:
            # Ensure class exists
            new_cls = await db.classes.find_one_and_update(
                {
                    "name": proposed_class,
                    "academic_year_id": academic_year_id,
                    "institution_code": user.institution_code
                },
                {"$setOnInsert": {
                    "name": proposed_class,
                    "academic_year_id": academic_year_id,
                    "institution_code": user.institution_code,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True,
                return_document=True
            )

            # Move student
            await db.users.update_one(
                {"user_id": user_id, "institution_code": user.institution_code},
                {"$set": {"enrolled_class": new_cls["name"]}}
            )
            success_count += 1
        except Exception as e:
            errors.append(f"Gagal memindahkan {promo.get('email')}: {e}")

    await write_audit(
        user.user_id,
        "STUDENTS_PROMOTED_CSV",
        {"count": success_count, "errors": len(errors)},
        request.client.host if request.client else ""
    )

    return {
        "status": "success",
        "message": f"Berhasil memindahkan/mempromosikan {success_count} siswa.",
        "failed": errors
    }

@router.get("/admin/teachers")
async def list_institution_teachers(
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    teachers = await db.users.find({
        "institution_code": user.institution_code,
        "role": "pengajar"
    }, {
        "_id": 0,
        "user_id": 1,
        "name": 1,
        "email": 1,
        "title": 1,
        "status": 1
    }).to_list(200)

    return {"teachers": teachers}

@router.get("/admin/audit-logs")
async def get_institution_audit_logs(
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah)),
    limit: int = 100
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    # Fetch users belonging to the institution to filter audit logs
    inst_users = await db.users.distinct("user_id", {"institution_code": user.institution_code})

    logs = await db.audit_logs.find(
        {"user_id": {"$in": inst_users}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)

    return {"audit_logs": logs}

@router.post("/admin/users/teachers")
async def create_institution_teacher(
    payload: CreateTeacherPayload,
    request: Request,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    email = payload.email.strip().lower()
    
    # Check if user already exists locally
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Email sudah terdaftar di sistem")

    # 1. Sign up user in Supabase Auth to enable login
    supa_user_id = None
    if SUPABASE_URL:
        if SUPABASE_SERVICE_ROLE_KEY:
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
                            "password": payload.password,
                            "email_confirm": True,
                            "user_metadata": {
                                "full_name": payload.name,
                                "name": payload.name,
                                "created_by_admin": True
                            }
                        }
                    )
                if r.status_code in (200, 201):
                    supa_data = r.json()
                    supa_user_id = supa_data.get("id") or supa_data.get("user", {}).get("id")
                else:
                    logger.warning(f"Supabase admin signup returned {r.status_code}: {r.text}")
                    raise HTTPException(400, f"Gagal membuat kredensial login (admin): {r.json().get('msg', 'Error Supabase')}")
            except HTTPException:
                raise
            except Exception as e:
                logger.exception(f"Error registering teacher in Supabase via Admin API: {e}")
                raise HTTPException(500, f"Gagal sinkronisasi kredensial auth (admin): {e}")
        elif SUPABASE_ANON_KEY:
            try:
                async with httpx.AsyncClient(timeout=15.0) as hc:
                    r = await hc.post(
                        f"{SUPABASE_URL}/auth/v1/signup",
                        headers={
                            "apikey": SUPABASE_ANON_KEY,
                            "Content-Type": "application/json",
                        },
                        json={
                            "email": email,
                            "password": payload.password,
                            "options": {
                                "data": {
                                    "full_name": payload.name,
                                    "name": payload.name,
                                    "created_by_admin": True
                                }
                            }
                        }
                    )
                if r.status_code == 200:
                    supa_data = r.json()
                    supa_user_id = supa_data.get("id") or supa_data.get("user", {}).get("id")
                else:
                    logger.warning(f"Supabase signup returned {r.status_code}: {r.text}")
                    raise HTTPException(400, f"Gagal membuat kredensial login: {r.json().get('msg', 'Error Supabase')}")
            except HTTPException:
                raise
            except Exception as e:
                logger.exception(f"Error registering teacher in Supabase: {e}")
                raise HTTPException(500, f"Gagal sinkronisasi kredensial auth: {e}")

    user_id = supa_user_id or f"user_{uuid.uuid4().hex[:12]}"

    from deps.auth import _generate_unique_friend_code
    friend_code = await _generate_unique_friend_code(payload.name)

    titles_list = payload.titles if payload.titles else ([payload.title] if payload.title else [])
    primary_title = payload.title if payload.title else (titles_list[0] if titles_list else None)

    # 2. Insert user doc to local MongoDB users collection
    new_teacher = {
        "user_id": user_id,
        "email": email,
        "name": payload.name,
        "picture": "",
        "friend_code": friend_code,
        "role": "pengajar",
        "title": primary_title,
        "titles": titles_list,
        "status": "active",
        "onboarded": True,
        "is_institution_linked": True,
        "institution_code": user.institution_code,
        "institution": user.institution,
        "education_level": user.education_level,
        "major": user.major,
        "account_type": "perusahaan",
        "nip": payload.nip,
        "created_by_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if TeacherTitle.guru_kelas in titles_list or "guru_kelas" in titles_list:
        new_teacher["assigned_class"] = payload.assigned_class
    else:
        new_teacher["assigned_class"] = None

    if TeacherTitle.guru_pengajar in titles_list or "guru_pengajar" in titles_list:
        new_teacher["assigned_subject"] = payload.assigned_subject
        new_teacher["teaching_classes"] = payload.teaching_classes or []
    else:
        new_teacher["assigned_subject"] = None
        new_teacher["teaching_classes"] = []

    if TeacherTitle.kajur in titles_list or "kajur" in titles_list:
        new_teacher["major"] = payload.major
    elif TeacherTitle.guru_kelas in titles_list or "guru_kelas" in titles_list:
        new_teacher["major"] = payload.major

    await db.users.insert_one(new_teacher)
    new_teacher.pop("_id", None)

    await write_audit(
        user.user_id,
        "TEACHER_CREATED",
        {"teacher_user_id": user_id, "email": email, "titles": [t.value if hasattr(t, "value") else t for t in titles_list]},
        request.client.host if request.client else ""
    )

    return {"status": "success", "user": new_teacher}

@router.get("/admin/users/teachers/{id}")
async def get_teacher_details(
    id: str,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    teacher = await db.users.find_one({
        "user_id": id,
        "institution_code": user.institution_code,
        "role": "pengajar"
    }, {"_id": 0})
    if not teacher:
        raise HTTPException(404, "Guru tidak ditemukan")

    # Normalize missing/null fields so frontend always gets consistent data
    teacher.setdefault("titles", [teacher["title"]] if teacher.get("title") else [])
    teacher.setdefault("teaching_classes", [])
    if teacher.get("teaching_classes") is None:
        teacher["teaching_classes"] = []

    return teacher

@router.put("/admin/users/teachers/{id}")
async def update_teacher_details(
    id: str,
    payload: UpdateTeacherPayload,
    request: Request,
    user: User = Depends(require_title(TeacherTitle.kepala_sekolah))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    teacher = await db.users.find_one({
        "user_id": id,
        "institution_code": user.institution_code,
        "role": "pengajar"
    })
    if not teacher:
        raise HTTPException(404, "Guru tidak ditemukan")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.nip is not None:
        updates["nip"] = payload.nip.strip()

    if payload.titles is not None:
        updates["titles"] = payload.titles
        if payload.titles:
            updates["title"] = payload.titles[0]
        else:
            updates["title"] = None
    elif payload.title is not None:
        updates["title"] = payload.title
        updates["titles"] = [payload.title]

    active_titles = updates.get("titles", teacher.get("titles") or ([updates.get("title")] if updates.get("title") else ([teacher.get("title")] if teacher.get("title") else [])))

    if TeacherTitle.guru_kelas in active_titles or "guru_kelas" in active_titles:
        if payload.assigned_class is not None:
            updates["assigned_class"] = payload.assigned_class
    else:
        updates["assigned_class"] = None

    if TeacherTitle.guru_pengajar in active_titles or "guru_pengajar" in active_titles:
        updates["assigned_subject"] = payload.assigned_subject if payload.assigned_subject is not None else teacher.get("assigned_subject")
        updates["teaching_classes"] = payload.teaching_classes if payload.teaching_classes is not None else teacher.get("teaching_classes", [])
    else:
        updates["assigned_subject"] = None
        updates["teaching_classes"] = []

    if TeacherTitle.kajur in active_titles or "kajur" in active_titles:
        if payload.major is not None:
            updates["major"] = payload.major
    elif TeacherTitle.guru_kelas in active_titles or "guru_kelas" in active_titles:
        if payload.major is not None:
            updates["major"] = payload.major
    else:
        updates["major"] = None

    # Verify admin password if changing password
    if payload.password is not None:
        if not payload.admin_password:
            raise HTTPException(400, "Password admin wajib diisi untuk verifikasi")
        try:
            async with httpx.AsyncClient(timeout=15.0) as hc:
                vr = await hc.post(
                    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                    headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                    json={"email": user.email, "password": payload.admin_password},
                )
            if vr.status_code != 200:
                raise HTTPException(403, "Verifikasi password admin gagal: password salah")
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Gagal verifikasi password admin: {e}")
            raise HTTPException(500, "Gagal memverifikasi password admin")

    # Update Supabase Auth (email / password) if service role key is available
    if payload.email is not None or payload.password is not None:
        supa_update = {}
        if payload.email is not None:
            supa_update["email"] = payload.email.strip().lower()
        if payload.password is not None:
            supa_update["password"] = payload.password

        if SUPABASE_SERVICE_ROLE_KEY and supa_update:
            try:
                async with httpx.AsyncClient(timeout=15.0) as hc:
                    r = await hc.put(
                        f"{SUPABASE_URL}/auth/v1/admin/users/{id}",
                        headers={
                            "apikey": SUPABASE_SERVICE_ROLE_KEY,
                            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=supa_update,
                    )
                if r.status_code not in (200, 201):
                    logger.warning(f"Supabase admin update user returned {r.status_code}: {r.text[:200]}")
            except Exception as e:
                logger.exception(f"Gagal update kredensial auth Supabase: {e}")

        if payload.email is not None:
            updates["email"] = payload.email.strip().lower()

    if updates:
        # Convert any enum objects to string values before saving to MongoDB
        mongo_updates = {}
        for k, v in updates.items():
            if k == "title" and v is not None:
                mongo_updates[k] = v.value if hasattr(v, "value") else v
            elif k == "titles" and v is not None:
                mongo_updates[k] = [item.value if hasattr(item, "value") else item for item in v]
            else:
                mongo_updates[k] = v
        
        await db.users.update_one({"user_id": id}, {"$set": mongo_updates})
        
        await write_audit(
            user.user_id,
            "TEACHER_UPDATED",
            {"teacher_user_id": id, "updates": list(mongo_updates.keys())},
            request.client.host if request.client else ""
        )

    updated_teacher = await db.users.find_one({"user_id": id}, {"_id": 0})
    return {"status": "success", "user": updated_teacher}


@router.get("/admin/academic-summary")
async def get_academic_summary(user: User = Depends(require_title(TeacherTitle.kepala_sekolah))):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi")

    active_year = await db.academic_years.find_one(
        {"institution_code": user.institution_code, "is_active": True},
        {"_id": 0}
    )

    results = await db.quiz_results.find(
        {
            "institution_code": user.institution_code,
            "source": "institution_class",
            "status": "ready"
        },
        {"_id": 0, "score": 1, "student_class": 1, "subject_name": 1, "user_id": 1}
    ).to_list(5000)

    from collections import defaultdict
    groups = defaultdict(lambda: {
        "classes": set(),
        "student_ids": set(),
        "subject_scores": defaultdict(list),
        "all_scores": []
    })

    GRADE_MAJOR_CACHE = {}

    def parse_grade_major(class_name):
        if not class_name:
            return ("", "")
        if class_name in GRADE_MAJOR_CACHE:
            return GRADE_MAJOR_CACHE[class_name]
        tokens = class_name.split()
        grade = tokens[0] if tokens and tokens[0].isdigit() else ""
        major = ""
        for t in tokens[1:-1] if len(tokens) > 2 else tokens[1:]:
            if t and not t.isdigit():
                major = t
                break
        GRADE_MAJOR_CACHE[class_name] = (grade, major)
        return (grade, major)

    for r in results:
        cls_name = r.get("student_class") or ""
        grade, major = parse_grade_major(cls_name)
        key = (grade, major)
        groups[key]["classes"].add(cls_name)
        if r.get("user_id"):
            groups[key]["student_ids"].add(r["user_id"])
        score = r.get("score", 0)
        groups[key]["all_scores"].append(score)
        subj = r.get("subject_name") or "Umum"
        groups[key]["subject_scores"][subj].append(score)

    grouped = []
    for (grade, major), data in groups.items():
        avg_score = round(sum(data["all_scores"]) / len(data["all_scores"]), 1) if data["all_scores"] else 0
        subjects = []
        for sname, scores in data["subject_scores"].items():
            subjects.append({
                "name": sname,
                "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
                "quiz_count": len(scores)
            })
        subjects.sort(key=lambda x: x["quiz_count"], reverse=True)
        grouped.append({
            "grade": grade,
            "major": major or "-",
            "class_names": sorted(data["classes"]),
            "student_count": len(data["student_ids"]),
            "quiz_count": len(data["all_scores"]),
            "avg_score": avg_score,
            "subjects": subjects
        })

    grouped.sort(key=lambda g: (g["grade"], g["major"]))

    return {
        "active_year": active_year,
        "groups": grouped,
        "total_results": len(results)
    }
