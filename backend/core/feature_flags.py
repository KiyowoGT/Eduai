from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from core.database import db
from models.user import User
from deps.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

class FeatureFlagService:
    @staticmethod
    async def get_flag(flag_name: str) -> Optional[Dict[str, Any]]:
        if db is None:
            return None
        return await db.feature_flags.find_one({"name": flag_name})

    @staticmethod
    async def is_enabled(flag_name: str, user: User) -> bool:
        # Superadmin always bypasses
        if user.is_superadmin:
            return True
        
        flag = await FeatureFlagService.get_flag(flag_name)
        if not flag:
            return False
            
        if flag.get("global_on", False):
            return True
            
        allowed_users = flag.get("allowed_users", [])
        if user.user_id in allowed_users or user.email in allowed_users:
            return True
            
        return False

async def check_feature(flag_name: str):
    """
    Usage:
    @router.get("/some-v1.2-feature")
    async def my_feature(enabled: bool = Depends(check_feature("ai_tutor_voice"))):
        if not enabled:
            raise HTTPException(status_code=403, detail="Feature not available")
        ...
    """
    async def _check(user: User = Depends(get_current_user)) -> bool:
        return await FeatureFlagService.is_enabled(flag_name, user)
    return _check

async def ensure_default_flags():
    if db is None:
        return
    
    # Flag v1.2: ai_tutor_voice
    await db.feature_flags.update_one(
        {"name": "ai_tutor_voice"},
        {"$setOnInsert": {
            "name": "ai_tutor_voice",
            "global_on": False,
            "allowed_users": ["admin-schooly@schooly.ac.id"],
            "description": "Virtual Tutor Voice Synthesis (v1.2)"
        }},
        upsert=True
    )
    logger.info("Default feature flags ensured.")
    
    # Default bugs if empty
    bug_count = await db.bugs.count_documents({})
    if bug_count == 0:
        await db.bugs.insert_many([
            {
                "id": "BUG-001",
                "title": "TTS Audio Crackling on Mobile",
                "severity": "High",
                "status": "In Progress",
                "created_by": "system",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "BUG-002",
                "title": "Quiz Result not syncing on Slow Network",
                "severity": "Medium",
                "status": "Open",
                "created_by": "system",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "BUG-003",
                "title": "Landing Page GSAP Animation Flicker",
                "severity": "Low",
                "status": "Fixed",
                "created_by": "system",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ])
        logger.info("Default bugs initialized in DB.")
