import re
import logging
from typing import Optional
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from core.database import db
from models.user import User, UserRole, TeacherTitle, ProfileUpdate, TeachingMethodsUpdate, FriendCodeUpdate, OnboardingCompletePayload

from deps.auth import (
    get_current_user,
    write_audit,
    fetch_supabase_user,
    get_or_create_local_user
)

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    """
    Unified session endpoint supporting both Supabase (access_token) and Legacy (session_id).
    """
    body = await request.json()
    access_token = body.get("access_token")
    session_id = body.get("session_id")

    if not access_token and not session_id:
        raise HTTPException(400, "access_token atau session_id wajib ada")

    if access_token:
        supa_user = await fetch_supabase_user(access_token)
        if not supa_user:
            raise HTTPException(401, "Token Supabase tidak valid")

        email = supa_user.get("email")
        if not email:
            raise HTTPException(401, "Email user tidak ditemukan")
        metadata = supa_user.get("user_metadata") or {}
        name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
        picture = metadata.get("avatar_url") or ""
        username = metadata.get("username") or metadata.get("preferred_username")

        user_doc = await get_or_create_local_user(email=email, name=name, picture=picture, username=username)
        await write_audit(user_doc["user_id"], "LOGIN_SUCCESS", {"email": email}, request.client.host if request.client else "")

        if isinstance(user_doc.get("created_at"), str):
            user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

        return {"user": user_doc}
    else:
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
        picture = data.get("picture") or ""
        session_token = data["session_token"]

        user_doc = await get_or_create_local_user(email=email, name=name, picture=picture)

        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_doc["user_id"],
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        await write_audit(user_doc["user_id"], "LOGIN_SUCCESS", {"email": email}, request.client.host if request.client else "")

        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
        )

        if isinstance(user_doc.get("created_at"), str):
            user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

        return {"user": user_doc}


@router.get("/auth/me")
async def auth_me(response: Response, user: User = Depends(get_current_user)):
    # Nonaktifkan cache browser sepenuhnya untuk otentikasi sesi
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    user_dict = user.model_dump()
    
    # Auto-sync folders to subjects for private/independent students (B2C)
    if user.role == "pelajar" and user.account_type == "pribadi":
        try:
            # Ambil folder aktif
            active_folders = await db.folders.find(
                {"user_id": user.user_id, "status": {"$ne": "deleted"}}
            ).to_list(100)
            
            existing_subjects = user.subjects or []
            existing_folder_ids = {s.get("folder_id") for s in existing_subjects if s.get("folder_id")}
            
            updated = False
            for f in active_folders:
                fid = f["folder_id"]
                fname = f["name"]
                if fid not in existing_folder_ids:
                    # Buat id mapel unik berbasis folder_id
                    subj_id = f"subj_{fid[:12]}"
                    existing_subjects.append({
                        "id": subj_id,
                        "name": fname,
                        "folder_id": fid
                    })
                    updated = True
            
            # Jika ada folder baru yang disinkronkan, update DB dan model cache
            if updated:
                await db.users.update_one(
                    {"user_id": user.user_id},
                    {"$set": {"subjects": existing_subjects}}
                )
                user_dict["subjects"] = existing_subjects
                user.subjects = existing_subjects
        except Exception as e:
            logger.warning(f"Gagal melakukan auto-sync folders ke subjects di auth_me: {e}")

    if not user.institution_code:
        # Kembalikan effective_grade jika grade_set_at ada, jika tidak, fallback ke data semester static
        user_dict["current_semester"] = user.effective_grade if user.grade_set_at else user.current_semester
    user_dict["is_institution_linked"] = bool(user.institution_code)
    user_dict["is_class_linked"] = bool(user.enrolled_class or user.class_token_used)
    user_dict["permissions"] = user.get_permissions()
    # Explicitly ensure onboarded is included from the validated model
    user_dict["onboarded"] = user.onboarded
    return user_dict


@router.post("/onboarding/complete")
async def onboarding_complete(payload: OnboardingCompletePayload, request: Request, user: User = Depends(get_current_user)):
    import random
    import string
    from services.sync_service import provision_for_class

    update_data = {
        "role": payload.role,
        "onboarded": True
    }
    if payload.username:
        username = payload.username.strip().lower()
        # Basic regex check for username (alphanumeric + underscore/dot)
        if not re.match(r"^[a-z0-9._]+$", username):
            raise HTTPException(400, "Username hanya boleh berisi huruf kecil, angka, titik, atau garis bawah")
        
        # Check uniqueness
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": user.user_id}})
        if existing:
            raise HTTPException(400, "Username sudah digunakan")
        update_data["username"] = username

    if payload.teaching_methods is not None:
        update_data["teaching_methods"] = payload.teaching_methods

    if payload.role == "pengajar":
        staff_passcode_clean = (payload.staff_passcode or "").strip()
        is_guru_mandiri = (
            payload.account_type == "pribadi"
            or (
                not payload.create_institution
                and not staff_passcode_clean
                and payload.account_type != "perusahaan"
            )
        )

        if not is_guru_mandiri:
            # Domain check removed for better user experience
            pass

        if is_guru_mandiri:
            update_data["account_type"] = "pribadi"
            update_data["title"] = None
            update_data["institution_code"] = None
            update_data["institution_owner"] = False
        elif payload.create_institution:
            inst_name = payload.create_institution.name.strip()
            inst_level = payload.create_institution.level.strip()
            inst_major = payload.create_institution.major.strip() if payload.create_institution.major else None
            if not inst_name or not inst_level:
                raise HTTPException(400, "Nama institusi dan jenjang wajib diisi")

            name_clean = "".join([c for c in inst_name if c.isalnum()]).upper()
            if not name_clean:
                name_clean = "SCH"
            name_clean = name_clean[:10]

            institution_code = None
            for attempt in range(10):
                rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
                code = f"{name_clean}-{rand_suffix}"
                try:
                    await db.institutions.insert_one({
                        "institution_code": code,
                        "name": inst_name,
                        "level": inst_level,
                        "major": inst_major,
                        "owner_user_id": user.user_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    institution_code = code
                    break
                except Exception as e:
                    if "11000" in str(e) and attempt < 9:
                        continue
                    raise HTTPException(500, "Gagal membuat kode institusi unik. Silakan coba lagi.")

            update_data["title"] = "kepala_sekolah"
            update_data["institution_code"] = institution_code
            update_data["institution_owner"] = True
            update_data["education_level"] = inst_level
            update_data["institution"] = inst_name
            update_data["major"] = inst_major
            update_data["account_type"] = "perusahaan"

            for attempt in range(10):
                suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
                pcode = f"{institution_code}-KRL-{suffix}"
                try:
                    await db.staff_passcodes.insert_one({
                        "passcode": pcode,
                        "institution_code": institution_code,
                        "title": "kurikulum",
                        "assigned_class": None,
                        "assigned_subject": None,
                        "created_by_user_id": user.user_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    break
                except Exception as e:
                    if "11000" in str(e) and attempt < 9:
                        continue
                    break
        elif staff_passcode_clean:
            passcode = staff_passcode_clean
            passcode_doc = await db.staff_passcodes.find_one({"passcode": passcode})
            if not passcode_doc:
                raise HTTPException(400, "Passcode staff tidak valid")

            inst_code = passcode_doc["institution_code"]
            institution_doc = await db.institutions.find_one({"institution_code": inst_code})

            update_data["title"] = passcode_doc["title"]
            update_data["institution_code"] = inst_code
            update_data["institution_owner"] = False
            update_data["assigned_class"] = passcode_doc.get("assigned_class")
            update_data["assigned_subject"] = passcode_doc.get("assigned_subject")
            update_data["institution"] = institution_doc.get("name") if institution_doc else ""
            update_data["education_level"] = institution_doc.get("level") if institution_doc else ""
            update_data["major"] = institution_doc.get("major") if institution_doc else None
            update_data["account_type"] = "perusahaan"
        else:
            update_data["account_type"] = "pribadi"
            update_data["title"] = None
            update_data["institution_code"] = None
            update_data["institution_owner"] = False

    elif payload.role == "pelajar":
        if payload.class_token:
            token = payload.class_token.strip()
            token_doc = await db.class_tokens.find_one({"class_token": token})
            if not token_doc:
                raise HTTPException(400, "Class token tidak valid")

            inst_code = token_doc["institution_code"]
            institution_doc = await db.institutions.find_one({"institution_code": inst_code})
            
            # Get active academic year
            active_year = await db.academic_years.find_one({"institution_code": inst_code, "is_active": True})

            update_data["institution_code"] = inst_code
            update_data["class_token_used"] = token
            update_data["enrolled_class"] = token_doc["target_class_room"]
            update_data["education_level"] = token_doc["level"]
            update_data["current_semester"] = token_doc["target_semester_or_grade"]
            update_data["institution"] = institution_doc.get("name") if institution_doc else ""
            level = token_doc.get("level")
            major = token_doc.get("major") or (institution_doc.get("major") if institution_doc else None)
            sma_equiv = {"SMA", "SMK", "MA", "MAK"}
            if level in sma_equiv and not major:
                raise HTTPException(
                    400,
                    "Jurusan wajib diisi untuk jenjang SMA/SMK/MA. "
                    "Silakan minta admin/kepsek membuat ulang token kelas dengan jurusan, atau lengkapi jurusan institusi."
                )
            update_data["major"] = major
            update_data["account_type"] = "perusahaan"
            update_data["nis"] = payload.nis
            update_data["nisn"] = payload.nisn
            if active_year:
                update_data["academic_year_id"] = active_year.get("academic_year_id")

            # Final update is handled below
            await provision_for_class(user.user_id, token_doc)
        else:
            update_data["education_level"] = payload.education_level
            update_data["institution"] = payload.institution
            update_data["current_semester"] = payload.current_semester
            update_data["grade_set_at"] = datetime.now(timezone.utc).isoformat()
            update_data["major"] = payload.major
            update_data["institution_code"] = None
            update_data["class_token_used"] = None
            update_data["enrolled_class"] = None
            update_data["account_type"] = "pribadi"
            update_data["nis"] = None
            update_data["nisn"] = None
            update_data["academic_year_id"] = None

    unset_fields = {}
    if payload.role == "pengajar" and update_data.get("account_type") == "pribadi":
        unset_fields = {
            "assigned_class": "",
            "assigned_subject": "",
            "class_token_used": "",
            "enrolled_class": "",
        }

    if unset_fields:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data, "$unset": unset_fields},
        )
    else:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    await write_audit(user.user_id, "ONBOARDING_COMPLETED", {"role": payload.role}, request.client.host if request.client else "")

    updated_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if isinstance(updated_doc.get("created_at"), str):
        updated_doc["created_at"] = datetime.fromisoformat(updated_doc["created_at"])

    user_obj = User(**updated_doc)
    updated_doc["is_institution_linked"] = bool(updated_doc.get("institution_code"))
    updated_doc["is_class_linked"] = bool(updated_doc.get("enrolled_class") or updated_doc.get("class_token_used"))
    updated_doc["permissions"] = user_obj.get_permissions()
    return updated_doc


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@router.put("/profile")
async def update_profile(payload: ProfileUpdate, request: Request, user: User = Depends(get_current_user)):
    if user.role == "pelajar" and user.enrolled_class:
        academic_fields = [payload.name, payload.username, payload.education_level, payload.major, payload.institution, payload.current_semester]
        if any(f is not None for f in academic_fields):
            raise HTTPException(
                403,
                "Pelajar yang terdaftar di institusi tidak dapat mengubah profil akademik secara mandiri."
            )
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name
    if payload.username is not None:
        username = payload.username.strip().lower()
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": user.user_id}})
        if existing:
            raise HTTPException(400, "Username sudah digunakan")
        update_data["username"] = username
    if payload.education_level is not None:
        LEVELS_NO_MAJOR = {"SD", "SMP"}
        update_data["education_level"] = payload.education_level
        update_data["major"] = payload.major if payload.education_level not in LEVELS_NO_MAJOR else None
        update_data["onboarded"] = True
    if payload.institution is not None:
        update_data["institution"] = payload.institution
    if payload.current_semester is not None:
        update_data["current_semester"] = payload.current_semester
        if not user.institution_code:  # pelajar mandiri → reset grade_set_at
            update_data["grade_set_at"] = datetime.now(timezone.utc).isoformat()
    if payload.teaching_methods is not None:
        update_data["teaching_methods"] = payload.teaching_methods
    if payload.clone_voice_enabled is not None:
        update_data["clone_voice_enabled"] = payload.clone_voice_enabled
    if payload.clone_voice_url is not None:
        update_data["clone_voice_url"] = payload.clone_voice_url
    if payload.hobby is not None:
        update_data["hobby"] = payload.hobby
    if payload.music_genre is not None:
        update_data["music_genre"] = payload.music_genre

    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data},
        )
        await write_audit(user.user_id, "PROFILE_UPDATE", payload.model_dump(), request.client.host if request.client else "")
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return user_doc


@router.put("/profile/friend-code")
async def update_friend_code(payload: FriendCodeUpdate, request: Request, user: User = Depends(get_current_user)):
    code = payload.friend_code.strip().lower()
    if not code:
        raise HTTPException(400, "Friend code tidak boleh kosong")
    if not re.match(r'^[a-z0-9_]{3,20}$', code):
        raise HTTPException(400, "Friend code hanya boleh huruf, angka, underscore (3-20 karakter)")
    if code == user.friend_code:
        return {"friend_code": code}
    existing = await db.users.find_one({"friend_code": code}, {"_id": 0, "user_id": 1})
    if existing:
        raise HTTPException(409, "Friend code sudah dipakai user lain")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"friend_code": code}},
    )
    await write_audit(user.user_id, "FRIEND_CODE_UPDATE", {"friend_code": code}, request.client.host if request.client else "")
    return {"friend_code": code}


@router.put("/profile/teaching-methods")
async def update_teaching_methods(payload: TeachingMethodsUpdate, request: Request, user: User = Depends(get_current_user)):
    valid = {"real_world", "imagination", "independence", "confidence"}
    for m in payload.teaching_methods:
        if m not in valid:
            raise HTTPException(400, f"Metode '{m}' tidak valid. Pilihan: {', '.join(valid)}")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"teaching_methods": payload.teaching_methods}},
    )
    await write_audit(user.user_id, "TEACHING_METHODS_UPDATE", {"teaching_methods": payload.teaching_methods}, request.client.host if request.client else "")
    return {"teaching_methods": payload.teaching_methods}


class SwitchRolePayload(BaseModel):
    role_type: str

@router.post("/auth/switch-role")
async def switch_role(payload: SwitchRolePayload, request: Request, user: User = Depends(get_current_user)):
    is_valid_role = False
    scope_id = None
    target_role = UserRole.pengajar # Default target role

    if payload.role_type == "pelajar" and (user.role == UserRole.pelajar or user.enrolled_class):
        is_valid_role = True
        target_role = UserRole.pelajar
    else:
        # Check allowed roles from role_assignments
        assignment = await db.role_assignments.find_one({
            "user_id": user.user_id,
            "role_type": payload.role_type,
            "status": "active"
        })

        if assignment:
            is_valid_role = True
            scope_id = assignment.get("scope_id")
        elif payload.role_type == "kepala_sekolah" and user.institution_owner:
            is_valid_role = True
        elif payload.role_type in [t.value if hasattr(t, "value") else t for t in user.all_titles]:
            is_valid_role = True
            if payload.role_type == "guru_kelas":
                scope_id = user.assigned_class
            elif payload.role_type == "guru_pengajar":
                scope_id = user.assigned_subject
            else:
                scope_id = None

    if not is_valid_role:
        raise HTTPException(status_code=403, detail="Peran tidak terdaftar atau tidak aktif")

    # Persist active context. Do not wipe the other persona's scope fields.
    update_fields = {"role": target_role, "active_role": payload.role_type, "active_scope_id": scope_id}

    if target_role != UserRole.pelajar:
        update_fields["title"] = payload.role_type

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_fields}
    )

    # If cookie session is used, update the session values
    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        await db.user_sessions.update_one(
            {"session_token": cookie_token},
            {"$set": {"active_role": payload.role_type, "active_scope_id": scope_id}}
        )

    await write_audit(
        user.user_id,
        "ROLE_SWITCHED",
        {"switched_to_role": payload.role_type, "scope_id": scope_id},
        request.client.host if request.client else ""
    )

    # Fetch updated user doc
    updated_user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not updated_user_doc:
        raise HTTPException(404, "User tidak ditemukan")

    if isinstance(updated_user_doc.get("created_at"), str):
        updated_user_doc["created_at"] = datetime.fromisoformat(updated_user_doc["created_at"])

    # Ensure linked status flags are set for the model
    updated_user_doc["is_institution_linked"] = bool(updated_user_doc.get("institution_code"))
    updated_user_doc["is_class_linked"] = bool(updated_user_doc.get("enrolled_class") or updated_user_doc.get("class_token_used"))

    # Validate with model
    updated_user_model = User(**updated_user_doc)
    
    # Get clean dict with permissions
    user_dict = updated_user_model.model_dump()
    user_dict["permissions"] = updated_user_model.get_permissions()

    return {
        "ok": True,
        "active_role": payload.role_type,
        "user": user_dict
    }

@router.get("/auth/roles")
async def get_user_roles(user: User = Depends(get_current_user)):
    roles_list = []

    # Pelajar role only if user is a student or has student data
    if user.role == UserRole.pelajar or user.enrolled_class:
        roles_list.append({
            "role_type": "pelajar",
            "scope_id": None,
            "status": "active"
        })

    if not user.institution_code:
        return {"roles": roles_list}

    # Ensure all titles in user.all_titles (from titles array and title field) are in list
    for t in user.all_titles:
        t_val = t.value if hasattr(t, "value") else t
        if not any(r["role_type"] == t_val for r in roles_list):
            scope_id = None
            if t_val == "guru_kelas":
                scope_id = user.assigned_class
            elif t_val == "guru_pengajar":
                scope_id = user.assigned_subject
            
            roles_list.append({
                "role_type": t_val,
                "scope_id": scope_id,
                "status": "active"
            })

    # Check for additional active role assignments in DB
    assignments = await db.role_assignments.find({
        "user_id": user.user_id,
        "status": "active"
    }, {"_id": 0}).to_list(100)

    for a in assignments:
        if not any(r["role_type"] == a["role_type"] for r in roles_list):
            roles_list.append(a)

    # Ensure owner has kepala_sekolah
    if user.institution_owner and not any(r["role_type"] == "kepala_sekolah" for r in roles_list):
        roles_list.append({
            "role_type": "kepala_sekolah",
            "scope_id": None,
            "status": "active"
        })

    return {"roles": roles_list}


@router.get("/auth/resolve-identifier")
async def resolve_identifier(q: str):
    q = q.strip().lower()
    # If it looks like an email, return it directly
    if "@" in q:
        return {"email": q}
    # Otherwise look up in MongoDB (for users who have completed onboarding)
    user_doc = await db.users.find_one({"username": q}, {"email": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Email/Username tidak ditemukan")
    return {"email": user_doc["email"]}


@router.get("/auth/check-existence")
async def check_existence(email: Optional[str] = None, username: Optional[str] = None):
    """
    Memeriksa apakah email atau username sudah terdaftar.
    """
    if email:
        email = email.strip().lower()
        import re
        user_doc = await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}, {"_id": 1})
        if user_doc:
            return {"exists": True, "type": "email"}
    
    if username:
        username = username.strip().lower()
        user_doc = await db.users.find_one({"username": username}, {"_id": 1})
        if user_doc:
            return {"exists": True, "type": "username"}
            
    return {"exists": False}


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[str] = None


@router.put("/admin/institution")
async def update_institution(payload: InstitutionUpdate, request: Request, user: User = Depends(get_current_user)):
    if not user.institution_owner:
        raise HTTPException(403, "Hanya pemilik institusi yang dapat mengubah data institusi")
    update = {}
    if payload.name is not None:
        update["name"] = payload.name.strip()
    if payload.level is not None:
        update["level"] = payload.level.strip()
    if not update:
        raise HTTPException(400, "Tidak ada data yang diubah")
    await db.institutions.update_one(
        {"institution_code": user.institution_code},
        {"$set": update},
    )
    if payload.name is not None:
        await db.users.update_many(
            {"institution_code": user.institution_code},
            {"$set": {"institution": payload.name.strip()}},
        )
    await write_audit(user.user_id, "INSTITUTION_UPDATE", update, request.client.host if request.client else "")
    return {"ok": True, **update}


@router.get("/diag/me-data")
async def diag_me_data(user: User = Depends(get_current_user)):
    """
    Debug helper: verify what the backend sees for the current authenticated user.
    Returns non-sensitive counts only (no passwords/hashes).
    """
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password": 0, "hash": 0})
    inst = (user_doc or {}).get("institution_code") or user.institution_code

    docs_own = await db.documents.count_documents({"user_id": user.user_id, "status": {"$ne": "deleted"}})
    docs_institution = 0
    if inst:
        docs_institution = await db.documents.count_documents({
            "institution_code": inst,
            "visibility": "institution",
            "status": {"$ne": "deleted"},
        })

    teacher_materials_base = {
        "status": {"$ne": "deleted"},
        "$or": [{"user_id": user.user_id}],
    }
    if inst:
        teacher_materials_base["$or"].append({"institution_code": inst, "visibility": "institution"})
    docs_teacher_materials_base = await db.documents.count_documents(teacher_materials_base)

    schedules = 0
    if inst:
        schedules = await db.shared_schedules.count_documents({"institution_code": inst})

    return {
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
            "title": user.title,
            "titles": user.titles,
            "institution_code": user.institution_code,
            "assigned_class": user.assigned_class,
            "assigned_subject": user.assigned_subject,
            "teaching_classes": getattr(user, "teaching_classes", None),
        },
        "db_user_doc_found": bool(user_doc),
        "counts": {
            "documents_own": docs_own,
            "documents_institution": docs_institution,
            "documents_teacher_materials_base": docs_teacher_materials_base,
            "shared_schedules_institution": schedules,
        },
    }


class VerifyPasswordPayload(BaseModel):
    password: str

@router.post("/auth/verify-password")
async def verify_password(payload: VerifyPasswordPayload, user: User = Depends(get_current_user)):
    """Verify the current user's password against Supabase."""
    from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, "Auth service tidak tersedia")
    async with httpx.AsyncClient(timeout=10.0) as hc:
        r = await hc.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": user.email, "password": payload.password},
        )
    if r.status_code != 200:
        raise HTTPException(403, "Password salah")
    return {"ok": True}


class VerifyPasswordPayload(BaseModel):
    password: str

@router.post("/auth/verify-password")
async def verify_password(payload: VerifyPasswordPayload, user: User = Depends(get_current_user)):
    """Verify the current user's password against Supabase."""
    from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(503, "Auth service tidak tersedia")
    async with httpx.AsyncClient(timeout=10.0) as hc:
        r = await hc.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": user.email, "password": payload.password},
        )
    if r.status_code != 200:
        raise HTTPException(403, "Password salah")
    return {"ok": True}
