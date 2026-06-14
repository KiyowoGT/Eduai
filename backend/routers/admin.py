from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime, timezone, timedelta
from deps.rbac import admin_required
from models.user import User, UserRole
from core.database import db
import psutil

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_required)])

@router.get("/system-stats")
async def get_system_stats(_: User = Depends(admin_required)):
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    req_count = await db.audit_logs.count_documents({"timestamp": {"$gte": day_ago}})
    
    return {
        "cpu": cpu,
        "ram_used_gb": round(mem.used / 1024**3, 1),
        "ram_total_gb": round(mem.total / 1024**3, 1),
        "disk_free_gb": round(disk.free / 1024**3, 1),
        "req_24h": req_count
    }


# Bug Management
class BugUpdate(BaseModel):
    status: str

class BugCreate(BaseModel):
    title: str
    severity: str
    status: str = "Open"

@router.get("/bugs")
async def list_bugs(_: User = Depends(admin_required)):
    bugs = await db.bugs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bugs

@router.post("/bugs")
async def create_bug(payload: BugCreate, user: User = Depends(admin_required)):
    import uuid
    new_bug = {
        "id": f"BUG-{uuid.uuid4().hex[:4].upper()}",
        "title": payload.title,
        "severity": payload.severity,
        "status": payload.status,
        "created_by": user.email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bugs.insert_one(new_bug)
    new_bug.pop("_id", None)
    return new_bug

@router.patch("/bugs/{bug_id}")
async def update_bug_status(bug_id: str, payload: BugUpdate, _: User = Depends(admin_required)):
    await db.bugs.update_one({"id": bug_id}, {"$set": {"status": payload.status}})
    return {"ok": True}

# Endpoint buat User (Guru/Murid) Lapor Bug
@router.post("/report-from-user", tags=["user-report"])
async def report_bug_user(payload: BugCreate, user: User = Depends(get_current_user)):
    import uuid
    new_bug = {
        "id": f"USER-BUG-{uuid.uuid4().hex[:4].upper()}",
        "title": payload.title,
        "severity": payload.severity,
        "status": "Open",
        "created_by": f"{user.name} ({user.role})",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_from_user": True
    }
    await db.bugs.insert_one(new_bug)
    return {"message": "Laporan berhasil dikirim. Terima kasih!"}
async def list_all_users(_: User = Depends(admin_required)):
    """Return basic info of every user."""
    users = await db.users.find({}, {
        "_id": 0, "user_id": 1, "email": 1, "name": 1,
        "role": 1, "suspended_until": 1, "created_at": 1,
        "education_level": 1, "is_superadmin": 1
    }).to_list(5000)
    return users

# Suspend a user temporarily
@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, payload: dict = {} , admin: User = Depends(admin_required)):
    """Suspend user for a given duration.
    payload may contain 'duration_minutes' (int) or 'until' (ISO datetime string).
    """
    now = datetime.now(timezone.utc)
    if "duration_minutes" in payload:
        suspend_until = now + timedelta(minutes=int(payload["duration_minutes"]))
    elif "until" in payload:
        suspend_until = datetime.fromisoformat(payload["until"]).astimezone(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="Missing suspension duration")
    await db.users.update_one({"user_id": user_id}, {"$set": {"suspended_until": suspend_until}})
    return {"ok": True, "suspended_until": suspend_until.isoformat()}

# Ban (delete) a user permanently
@router.delete("/users/{user_id}")
async def ban_user(user_id: str, admin: User = Depends(admin_required)):
    """Delete user from Supabase Auth and MongoDB."""
    # 1. Ambil user info dari DB
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    # 2. Pakai auth_uid kalau ada, kalau ga ada pake user_id
    auth_uid = user.get("auth_uid", user_id)
    
    # 3. Delete dari MongoDB
    await db.users.delete_one({"user_id": user_id})
    
    # 4. Delete dari Supabase (jika masih ada)
    import httpx, os
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    async with httpx.AsyncClient() as client:
        # Coba cek user di Supabase dulu
        check_resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users/{auth_uid}",
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
        )
        
        if check_resp.status_code == 200: # User ditemukan di Supabase, hapus
            delete_resp = await client.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{auth_uid}",
                headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
            )
            if delete_resp.status_code not in (200, 204, 202):
                print(f"DEBUG: Supabase delete failed. Status: {delete_resp.status_code}, Body: {delete_resp.text}")
                # Jangan raise error, karena user sudah terhapus di MongoDB. Cukup log.
                # raise HTTPException(status_code=delete_resp.status_code, detail=f"Gagal hapus Supabase: {delete_resp.text}")
        elif check_resp.status_code == 404: # User tidak ada di Supabase, tidak perlu dihapus
            print(f"DEBUG: User {auth_uid} tidak ditemukan di Supabase Auth. Hanya hapus dari MongoDB.")
        else: # Error lain saat cek Supabase
            print(f"DEBUG: Gagal cek user di Supabase Auth. Status: {check_resp.status_code}, Body: {check_resp.text}")
            # Jangan raise error, karena user sudah terhapus di MongoDB. Cukup log.
            # raise HTTPException(status_code=check_resp.status_code, detail=f"Gagal cek user Supabase: {check_resp.text}")
            
    return {"ok": True}


# --- BUG TRACKER API ---
@router.get("/bugs")
async def list_bugs(_: User = Depends(admin_required)):
    bugs = await db.bugs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bugs

@router.post("/bugs")
async def create_bug(payload: dict, admin: User = Depends(admin_required)):
    import uuid
    # Generate BUG-XXX ID
    count = await db.bugs.count_documents({})
    bug_id = f"BUG-{count + 1:03d}"
    
    new_bug = {
        "id": bug_id,
        "title": payload.get("title", "Untitled Bug").strip(),
        "severity": payload.get("severity", "Medium"), # High, Medium, Low
        "status": payload.get("status", "Open"), # Open, In Progress, Fixed
        "created_by": admin.email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bugs.insert_one(new_bug)
    return new_bug

@router.patch("/bugs/{bug_id}")
async def update_bug(bug_id: str, payload: dict, _: User = Depends(admin_required)):
    update_data = {}
    if "status" in payload:
        update_data["status"] = payload["status"]
    if "severity" in payload:
        update_data["severity"] = payload["severity"]
    if "title" in payload:
        update_data["title"] = payload["title"]
        
    await db.bugs.update_one({"id": bug_id}, {"$set": update_data})
    return {"ok": True}


