from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from deps.auth import get_current_user
from models.user import User
from core.database import db

router = APIRouter(prefix="", tags=["report"])

@router.post("/report-bug")
async def report_bug(
    payload: dict,
    user: User = Depends(get_current_user)
):
    """Public endpoint — siapa pun yg login bisa lapor bug."""
    count = await db.bugs.count_documents({})
    bug_id = f"BUG-{count + 1:03d}"

    new_bug = {
        "id": bug_id,
        "title": (payload.get("title") or "Untitled").strip(),
        "severity": payload.get("severity", "Medium"),
        "status": "Open",
        "created_by": user.email or user.name or "unknown",
        "submitted_by_user": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bugs.insert_one(new_bug)
    return new_bug
