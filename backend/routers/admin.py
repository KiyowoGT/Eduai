from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from deps.rbac import admin_required
from deps.auth import get_current_user
from models.user import User, UserRole
from core.database import db
import psutil
import uuid

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_required)])

class BugUpdate(BaseModel):
    status: str

class BugCreate(BaseModel):
    title: str
    severity: str
    status: str = "Open"

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

@router.get("/bugs")
async def list_bugs(_: User = Depends(admin_required)):
    bugs = await db.bugs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return bugs

@router.post("/bugs")
async def create_bug(payload: BugCreate, user: User = Depends(admin_required)):
    new_bug = {
        "id": f"BUG-{uuid.uuid4().hex[:4].upper()}",
        "title": payload.title,
        "severity": payload.severity,
        "status": payload.status,
        "created_by": user.email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bugs.insert_one(new_bug)
    return new_bug

@router.patch("/bugs/{bug_id}")
async def update_bug(bug_id: str, payload: BugUpdate, _: User = Depends(admin_required)):
    result = await db.bugs.update_one({"id": bug_id}, {"$set": {"status": payload.status}})
    if result.modified_count == 0:
        raise HTTPException(404, "Bug not found")
    return {"status": "updated"}

@router.delete("/bugs/{bug_id}")
async def delete_bug(bug_id: str, _: User = Depends(admin_required)):
    result = await db.bugs.delete_one({"id": bug_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Bug not found")
    return {"status": "deleted"}
