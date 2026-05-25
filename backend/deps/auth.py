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

async def get_or_create_local_user(email: str, name: str, picture: Optional[str] = None, username: Optional[str] = None) -> dict:
    if picture is None:
        picture = ""
    users_cursor = db.users.find({"email": email}, {"_id": 0}).sort([("onboarded", -1), ("created_at", 1)])
    users = await users_cursor.to_list(length=10)
    user = users[0] if users else None
    if user:
        updates = {"name": name, "picture": picture}
        if username:
            updates["username"] = username
        if not user.get("friend_code"):
            updates["friend_code"] = await _generate_unique_friend_code(name)
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": updates},
        )
        user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        friend_code = await _generate_unique_friend_code(name)
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "friend_code": friend_code,
            "onboarded": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
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
                    if isinstance(user_doc.get("created_at"), str):
                        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
                    user_doc["is_institution_linked"] = bool(user_doc.get("institution_code"))
                    user_doc["is_class_linked"] = bool(user_doc.get("enrolled_class") or user_doc.get("class_token_used"))
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

        user_doc = await get_or_create_local_user(email=email, name=name, picture=picture, username=username)
        if isinstance(user_doc.get("created_at"), str):
            user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

        user_doc["is_institution_linked"] = bool(user_doc.get("institution_code"))
        user_doc["is_class_linked"] = bool(user_doc.get("enrolled_class") or user_doc.get("class_token_used"))
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
    user_doc = await get_or_create_local_user(email=email, name=name, picture=picture, username=username)
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    user_doc["is_institution_linked"] = bool(user_doc.get("institution_code"))
    user_doc["is_class_linked"] = bool(user_doc.get("enrolled_class") or user_doc.get("class_token_used"))
    return User(**user_doc)

# --- Role-Based Access Control Dependencies ---

async def require_pengajar(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.pengajar:
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


