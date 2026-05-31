from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any

from deps.auth import get_current_user
from services import personality_service

router = APIRouter()

class SubmitPayload(BaseModel):
    answers: Dict[str, str]

@router.get("/personality/questions")
async def get_questions():
    return personality_service.get_questions()

@router.post("/personality/submit")
async def submit_personality(payload: SubmitPayload, user = Depends(get_current_user)):
    profile = await personality_service.evaluate_and_save(user, payload.answers)
    return {"ok": True, "profile": profile}

@router.get("/personality/profile")
async def get_profile(user = Depends(get_current_user)):
    profile = await personality_service.get_user_profile(user)
    return {"profile": profile}

@router.get("/teacher/class/{class_id}/personality-insights")
async def class_insights(class_id: str, user = Depends(get_current_user)):
    # permission checks for teacher role could be added
    data = await personality_service.get_class_insights(class_id)
    return data
