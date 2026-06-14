from fastapi import APIRouter, Depends, HTTPException
from deps.auth import get_current_user
from models.user import User
from core.database import db
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(prefix="/system", tags=["system"])

class BugReport(BaseModel):
    title: str
    severity: str = "Medium"

@router.post("/report-bug")
async def report_bug(payload: BugReport, user: User = Depends(get_current_user)):
    bug = {
        "id": f"BUG-{datetime.now().strftime('%M%S')}",
        "title": payload.title,
        "severity": payload.severity,
        "status": "Open",
        "created_by": user.email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bugs.insert_one(bug)
    return bug
