import re
import logging
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from core.database import db
from models.user import User, ProfileUpdate, TeachingMethodsUpdate, FriendCodeUpdate
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

        user_doc = await get_or_create_local_user(email=email, name=name, picture=picture)
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
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@router.put("/profile")
async def update_profile(payload: ProfileUpdate, request: Request, user: User = Depends(get_current_user)):
    LEVELS_NO_MAJOR = {"SD", "SMP"}
    major = payload.major if payload.education_level not in LEVELS_NO_MAJOR else None
    update_data = {
        "education_level": payload.education_level,
        "major": major,
        "institution": payload.institution,
        "current_semester": payload.current_semester,
        "onboarded": True,
    }
    if payload.teaching_methods is not None:
        update_data["teaching_methods"] = payload.teaching_methods
    if payload.clone_voice_enabled is not None:
        update_data["clone_voice_enabled"] = payload.clone_voice_enabled
    if payload.clone_voice_url is not None:
        update_data["clone_voice_url"] = payload.clone_voice_url
        
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
