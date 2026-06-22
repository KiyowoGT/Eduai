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

class AIConfigPayload(BaseModel):
    base_url: str
    api_key: str
    gemini_model: Optional[str] = "ag/gemini-3-flash"
    groq_model: Optional[str] = "ag/gemini-3-flash"

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

@router.get("/users")
async def list_users(_: User = Depends(admin_required)):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return {"users": users}

@router.get("/ai-config")
async def get_ai_config(_: User = Depends(admin_required)):
    import os
    env_path = "/mnt/hdd/Eduai/backend/.env"
    config = {"base_url": "", "api_key": "", "gemini_model": "", "groq_model": ""}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    key, val = line.strip().split("=", 1)
                    val = val.strip().strip("\"'")
                    if key == "GEMINI_BASE_URL":
                        config["base_url"] = val
                    elif key == "GEMINI_API_KEY":
                        config["api_key"] = val
                    elif key == "GEMINI_MODEL":
                        config["gemini_model"] = val
                    elif key == "GROQ_MODEL":
                        config["groq_model"] = val
    return config

@router.post("/ai-config")
async def update_ai_config(payload: AIConfigPayload, _: User = Depends(admin_required)):
    import os
    env_path = "/mnt/hdd/Eduai/backend/.env"
    lines = []
    updated_keys = {
        "GEMINI_BASE_URL": payload.base_url,
        "GEMINI_API_KEY": payload.api_key,
        "GEMINI_MODEL": payload.gemini_model,
        "GROQ_MODEL": payload.groq_model,
        "GEMINI_ANALYSIS_MODEL": payload.gemini_model
    }
    
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line:
                    parts = line.split("=", 1)
                    k = parts[0].strip()
                    if k in updated_keys:
                        lines.append(f"{k}={updated_keys[k]}\n")
                        del updated_keys[k]
                        continue
                lines.append(line)
                
    for k, v in updated_keys.items():
         lines.append(f"{k}={v}\n")
         
    with open(env_path, "w") as f:
        f.writelines(lines)
        
    return {"status": "success", "message": "Konfigurasi AI diperbarui."}

class AITestPayload(BaseModel):
    base_url: str
    api_key: str
    model: str

@router.post("/ai-config/test")
async def test_ai_connection(payload: AITestPayload, _: User = Depends(admin_required)):
    import httpx
    # Ensure URL ends with /v1
    base_url = payload.base_url.rstrip("/")
    url = f"{base_url}/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {payload.api_key}",
        "Content-Type": "application/json"
    }
    
    body = {
        "model": payload.model,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 5
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=body, headers=headers, timeout=10.0)
            if response.status_code == 200:
                return {"ok": True}
            else:
                return {"ok": False, "error": f"HTTP {response.status_code}: {response.text}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@router.post("/restart")
async def restart_backend(_: User = Depends(admin_required)):
    import os
    # Trigger self restart via systemd or exit to let systemd restart it
    os.system("systemctl --user restart eduai-backend.service &")
    return {"status": "success", "message": "Restarting..."}
