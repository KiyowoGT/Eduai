import re
import uuid
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import Request, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from enum import Enum

from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
from core.database import db
from models.user import User, UserRole, TeacherTitle

logger = logging.getLogger(__name__)

def _apply_active_context(user_doc: dict, active_role: Optional[str], active_scope_id: Optional[str]) -> dict:
    """
    Apply active portal/role context (from session or user_doc) to the returned user profile.

    Frontend routing and permissions depend on `role` and `title`, so this is the single
    place where we reconcile "capabilities" vs "active context".
    """
    if not user_doc or not active_role:
        return user_doc

    # Student portal
    if active_role == UserRole.pelajar.value:
        user_doc["role"] = UserRole.pelajar.value
        user_doc["title"] = None
        return user_doc

    # Teacher portal (title-based)
    teacher_titles = {t.value for t in TeacherTitle}
    if active_role in teacher_titles:
        user_doc["role"] = UserRole.pengajar.value
        user_doc["title"] = active_role
        if active_scope_id:
            if active_role == TeacherTitle.guru_kelas.value:
                user_doc["assigned_class"] = active_scope_id
            elif active_role == TeacherTitle.guru_pengajar.value:
                user_doc["assigned_subject"] = active_scope_id
        return user_doc

    return user_doc

async def _ensure_teacher_scopes(user_doc: dict) -> dict:
    """
    Self-heal missing `assigned_class` / `assigned_subject` for enterprise teachers.
    These fields may become empty after portal linking or legacy role switching.
    """
    try:
        if not user_doc:
            return user_doc
        if not user_doc.get("institution_code"):
            return user_doc

        title = user_doc.get("title")
        titles = user_doc.get("titles") or []

        updated = {}

        if (title == TeacherTitle.guru_kelas.value or TeacherTitle.guru_kelas.value in titles) and not user_doc.get("assigned_class"):
            ra = await db.role_assignments.find_one(
                {"user_id": user_doc.get("user_id"), "role_type": TeacherTitle.guru_kelas.value, "status": "active"},
                {"_id": 0}
            )
            if ra and ra.get("scope_id"):
                user_doc["assigned_class"] = ra["scope_id"]
                updated["assigned_class"] = ra["scope_id"]

        if (title == TeacherTitle.guru_pengajar.value or TeacherTitle.guru_pengajar.value in titles) and not user_doc.get("assigned_subject"):
            ra = await db.role_assignments.find_one(
                {"user_id": user_doc.get("user_id"), "role_type": TeacherTitle.guru_pengajar.value, "status": "active"},
                {"_id": 0}
            )
            if ra and ra.get("scope_id"):
                user_doc["assigned_subject"] = ra["scope_id"]
                updated["assigned_subject"] = ra["scope_id"]

        # Persist self-healed scopes so they survive backend restart / browser refresh.
        if updated:
            try:
                await db.users.update_one({"user_id": user_doc.get("user_id")}, {"$set": updated})
            except Exception as e:
                logger.warning(f"Gagal persist self-heal scopes: {e}")

    except Exception as e:
        logger.warning(f"Gagal self-heal teacher scopes: {e}")
    return user_doc

async def write_audit(user_id: str, action: str, details: dict = None, ip: str = ""):
    try:
        import random
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y%m%d")
        rand_num = random.randint(1, 9999)
        log_id = f"AUD-{today_str}-{rand_num:04d}"
        await db.audit_logs.insert_one({
            "log_id": log_id,
            "user_id": user_id,
            "action": action,
            "details": details or {},
            "ip_address": ip,
            "audit_date": now.strftime("%Y-%m-%d"),
            "timestamp": now.isoformat(),
        })
    except Exception as e:
        logger.error(f"Gagal menulis audit log: {e}")

async def _migrate_user_id_references(old_user_id: str, new_user_id: str) -> None:
    """
    When we rewrite `users.user_id` to match Supabase UUID, we must also update
    other collections that reference `user_id` (or related *_user_id fields).
    Otherwise, user data (documents, quizzes, etc.) will look "missing".
    """
    if not old_user_id or not new_user_id or old_user_id == new_user_id:
        return

    # Best-effort migrations. Don't fail login if one collection is missing.
    migrations = [
        (db.user_sessions, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.documents, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.pdf_files, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.quizzes, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.quiz_results, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.quiz_results, {"created_by": old_user_id}, {"$set": {"created_by": new_user_id}}),
        (db.quiz_progress, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.notifications, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.audit_logs, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.folders, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.recaps, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.role_assignments, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.student_sessions, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.friend_requests, {"from_user_id": old_user_id}, {"$set": {"from_user_id": new_user_id}}),
        (db.friend_requests, {"to_user_id": old_user_id}, {"$set": {"to_user_id": new_user_id}}),
        (db.friend_requests, {"target_user_id": old_user_id}, {"$set": {"target_user_id": new_user_id}}),
        (db.friend_blocks, {"blocker_user_id": old_user_id}, {"$set": {"blocker_user_id": new_user_id}}),
        (db.friend_blocks, {"blocked_user_id": old_user_id}, {"$set": {"blocked_user_id": new_user_id}}),
        (db.discussion_participants, {"user_id": old_user_id}, {"$set": {"user_id": new_user_id}}),
        (db.discussion_participants, {"invited_by": old_user_id}, {"$set": {"invited_by": new_user_id}}),
    ]

    for collection, filt, update_doc in migrations:
        try:
            await collection.update_many(filt, update_doc)
        except Exception as e:
            logger.warning(f"Gagal migrate user_id references on {getattr(collection, 'name', str(collection))}: {e}")

async def fetch_supabase_user(access_token: str) -> Optional[dict]:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logger.error("SUPABASE_URL / SUPABASE_ANON_KEY belum diset")
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            r = await hc.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": SUPABASE_ANON_KEY,
                },
            )
        if r.status_code != 200:
            logger.warning(f"Supabase /auth/v1/user responded {r.status_code}: {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        logger.exception(f"Gagal validasi token Supabase: {e}")
        return None

async def _generate_unique_friend_code(name: str) -> str:
    base = re.sub(r'[^a-zA-Z0-9_]', '', name.lower().replace(' ', '_'))
    base = base[:15]
    if not base:
        base = "user"
    for _ in range(10):
        code = f"{base}_{uuid.uuid4().hex[:4]}"
        existing = await db.users.find_one({"friend_code": code}, {"_id": 1})
        if not existing:
            return code
    return f"{base}_{uuid.uuid4().hex[:8]}"

async def get_or_create_local_user(email: str, name: str, picture: Optional[str] = None, username: Optional[str] = None, supa_user_id: Optional[str] = None, created_by_admin: Optional[bool] = None, role: Optional[str] = None) -> dict:
    if picture is None:
        picture = ""
    email_clean = email.strip().lower()
    
    # Prioritasi pencarian user case-insensitive (onboarded dahulu)
    users_cursor = db.users.find(
        {"email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"}},
        {"_id": 0}
    ).sort([("onboarded", -1), ("created_at", 1)])
    
    users = await users_cursor.to_list(length=10)
    user = users[0] if users else None
    
    if user:
        updates = {"name": name, "picture": picture}
        if username:
            updates["username"] = username
        if not user.get("friend_code"):
            updates["friend_code"] = await _generate_unique_friend_code(name)
        if created_by_admin is not None:
            updates["created_by_admin"] = created_by_admin
            if created_by_admin:
                updates["onboarded"] = True
        if role and not user.get("role"):
            updates["role"] = role
        
        # Sinkronisasikan ID lokal MongoDB dengan ID Supabase jika berbeda
        old_id = user["user_id"]
        if supa_user_id and old_id != supa_user_id:
            await _migrate_user_id_references(old_id, supa_user_id)
            updates["user_id"] = supa_user_id
            user["user_id"] = supa_user_id
            
        await db.users.update_one(
            {"user_id": old_id},
            {"$set": updates},
        )
        
        # Bersihkan akun duplikat kosong jika ada
        if len(users) > 1:
            await db.users.delete_many({
                "email": {"$regex": f"^{re.escape(email_clean)}$", "$options": "i"},
                "user_id": {"$ne": user["user_id"]}
            })
            
        user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    else:
        user_id = supa_user_id or f"user_{uuid.uuid4().hex[:12]}"
        friend_code = await _generate_unique_friend_code(name)
        new_user = {
            "user_id": user_id,
            "email": email_clean,
            "name": name,
            "picture": picture,
            "friend_code": friend_code,
            "onboarded": True if created_by_admin else False,
            "created_by_admin": created_by_admin,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if role:
            new_user["role"] = role
        if username:
            new_user["username"] = username
        await db.users.insert_one(new_user)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    return user

from pydantic import ValidationError

async def get_current_user(request: Request) -> User:
    token = None
    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        token = cookie_token

    auth = request.headers.get("Authorization", "")
    header_token = None
    if auth.startswith("Bearer "):
        header_token = auth.split(" ", 1)[1]
        if not token:
            token = header_token

    if token:
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user_doc:
                    user_doc = _apply_active_context(
                        user_doc,
                        session.get("active_role") or user_doc.get("active_role"),
                        session.get("active_scope_id"),
                    )
                    user_doc = await _ensure_teacher_scopes(user_doc)
                    if isinstance(user_doc.get("created_at"), str):
                        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
                    user_doc["is_institution_linked"] = bool(user_doc.get("institution_code"))
                    user_doc["is_class_linked"] = bool(user_doc.get("enrolled_class") or user_doc.get("class_token_used"))
                    if user_doc.get("institution_code") or user_doc.get("enrolled_class"):
                        if not user_doc.get("onboarded"):
                            await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"onboarded": True}})
                            user_doc["onboarded"] = True
                    try:
                        return User(**user_doc)
                    except ValidationError as e:
                        logger.error(f"User validation error (session): {e.json()}")
                        raise HTTPException(500, f"Data profil tidak valid: {str(e)}")

    if header_token:
        supa_user = await fetch_supabase_user(header_token)
        if not supa_user:
            raise HTTPException(401, "Token Supabase tidak valid atau sesi berakhir")

        email = supa_user.get("email")
        if not email:
            raise HTTPException(401, "Email user tidak ditemukan")

        metadata = supa_user.get("user_metadata") or {}
        name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
        picture = metadata.get("avatar_url") or ""
        username = metadata.get("username") or metadata.get("preferred_username")
        supa_id = supa_user.get("id")
        created_by_admin = metadata.get("created_by_admin")
        role = metadata.get("role")

        user_doc = await get_or_create_local_user(email=email, name=name, picture=picture, username=username, supa_user_id=supa_id, created_by_admin=created_by_admin, role=role)
        user_doc = _apply_active_context(
            user_doc,
            user_doc.get("active_role"),
            None,
        )
        user_doc = await _ensure_teacher_scopes(user_doc)
        if isinstance(user_doc.get("created_at"), str):
            user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

        user_doc["is_institution_linked"] = bool(user_doc.get("institution_code"))
        user_doc["is_class_linked"] = bool(user_doc.get("enrolled_class") or user_doc.get("class_token_used"))
        if user_doc.get("institution_code") or user_doc.get("enrolled_class"):
            if not user_doc.get("onboarded"):
                await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"onboarded": True}})
                user_doc["onboarded"] = True
        try:
            return User(**user_doc)
        except ValidationError as e:
            logger.error(f"User validation error (header): {e.json()}")
            raise HTTPException(500, f"Data profil tidak valid: {str(e)}")

    raise HTTPException(401, "Tidak terautentikasi")

async def get_current_user_from_access_token(access_token: str) -> User:
    if not access_token:
        raise HTTPException(401, "Token Supabase tidak valid")
    supa_user = await fetch_supabase_user(access_token)
    if not supa_user:
        raise HTTPException(401, "Token Supabase tidak valid")
    email = supa_user.get("email")
    if not email:
        raise HTTPException(401, "Email user tidak ditemukan")
    metadata = supa_user.get("user_metadata") or {}
    name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
    picture = metadata.get("avatar_url")
    username = metadata.get("username") or metadata.get("preferred_username")
    supa_id = supa_user.get("id")
    created_by_admin = metadata.get("created_by_admin")
    role = metadata.get("role")
    user_doc = await get_or_create_local_user(email=email, name=name, picture=picture, username=username, supa_user_id=supa_id, created_by_admin=created_by_admin, role=role)
    user_doc = _apply_active_context(
        user_doc,
        user_doc.get("active_role"),
        None,
    )
    user_doc = await _ensure_teacher_scopes(user_doc)
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    user_doc["is_institution_linked"] = bool(user_doc.get("institution_code"))
    user_doc["is_class_linked"] = bool(user_doc.get("enrolled_class") or user_doc.get("class_token_used"))
    if user_doc.get("institution_code") or user_doc.get("enrolled_class"):
        if not user_doc.get("onboarded"):
            await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": {"onboarded": True}})
            user_doc["onboarded"] = True
    return User(**user_doc)

# --- Role-Based Access Control Dependencies ---

async def require_pengajar(user: User = Depends(get_current_user)) -> User:
    # Some users can have both "pelajar" and "pengajar" personas (multi-portal).
    # Do not hard-block teacher endpoints if the user still has teacher titles set.
    if user.role != UserRole.pengajar and not user.all_titles and not user.institution_owner:
        raise HTTPException(status_code=403, detail="Akses ditolak: Hanya pengajar yang diperbolehkan")
    return user

async def require_pelajar(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.pelajar:
        raise HTTPException(status_code=403, detail="Akses ditolak: Hanya pelajar yang diperbolehkan")
    return user

def require_title(*allowed_titles: TeacherTitle):
    async def title_dependency(user: User = Depends(require_pengajar)) -> User:
        # Convert string enum titles to values for comparison
        title_values = [t.value if isinstance(t, Enum) else t for t in allowed_titles]
        user_titles = [t.value if isinstance(t, Enum) else t for t in user.all_titles]
        if not any(ut in title_values for ut in user_titles):
            raise HTTPException(status_code=403, detail=f"Akses ditolak: Hanya jabatan {', '.join(title_values)} yang diperbolehkan")
        return user
    return title_dependency


async def _create_notification(user_id: str, notif_type: str, message: str, data: Optional[dict] = None):
    doc = {
        "notification_id": uuid.uuid4().hex,
        "user_id": user_id,
        "type": notif_type,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)
    return doc["notification_id"]


async def _is_blocked_pair(user_a: str, user_b: str) -> bool:
    blocked = await db.friend_blocks.find_one({
        "$or": [
            {"blocker_user_id": user_a, "blocked_user_id": user_b},
            {"blocker_user_id": user_b, "blocked_user_id": user_a},
        ]
    }, {"_id": 0, "block_id": 1})
    return blocked is not None
