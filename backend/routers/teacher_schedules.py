import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User, TeacherTitle
from deps.auth import get_current_user, require_pengajar, require_title, write_audit

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateSchedulePayload(BaseModel):
    class_name: str
    day: str
    start_time: str
    end_time: str
    subject_name: str
    current_topic: Optional[str] = None

class UpdateSchedulePayload(BaseModel):
    class_name: Optional[str] = None
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    subject_name: Optional[str] = None
    current_topic: Optional[str] = None

class LinkResourcesPayload(BaseModel):
    validated_recap_id: Optional[str] = None
    published_quiz_id: Optional[str] = None

DAYS_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

def sort_schedules(schedules_list):
    day_idx = {day: idx for idx, day in enumerate(DAYS_ORDER)}
    return sorted(
        schedules_list,
        key=lambda x: (day_idx.get(x.get("day", "Senin"), 99), x.get("start_time", ""))
    )

@router.get("/teacher/schedules")
async def list_teacher_schedules(user: User = Depends(require_pengajar)):
    if not user.institution_code:
        return []

    query = {"institution_code": user.institution_code}
    if TeacherTitle.guru_kelas in user.all_titles and TeacherTitle.guru_pengajar in user.all_titles:
        subject_cond = {"subject_name": user.assigned_subject}
        classes = list(getattr(user, "teaching_classes", []) or [])
        if classes:
            subject_cond["class_name"] = {"$in": classes}
        query["$or"] = [
            {"class_name": user.assigned_class},
            subject_cond
        ]
    elif TeacherTitle.guru_kelas in user.all_titles:
        query["class_name"] = user.assigned_class
    elif TeacherTitle.guru_pengajar in user.all_titles:
        query["subject_name"] = user.assigned_subject
        classes = list(getattr(user, "teaching_classes", []) or [])
        if classes:
            query["class_name"] = {"$in": classes}

    schedules = await db.shared_schedules.find(query, {"_id": 0}).to_list(1000)
    return sort_schedules(schedules)

@router.post("/teacher/schedules")
async def create_teacher_schedule(
    payload: CreateSchedulePayload,
    request: Request,
    user: User = Depends(require_title("kurikulum"))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    schedule_id = uuid.uuid4().hex
    doc = {
        "schedule_id": schedule_id,
        "institution_code": user.institution_code,
        "class_name": payload.class_name,
        "day": payload.day,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "subject_name": payload.subject_name,
        "current_topic": payload.current_topic,
        "validated_recap_id": None,
        "published_quiz_id": None,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.shared_schedules.insert_one(doc.copy())

    await write_audit(
        user.user_id,
        "SHARED_SCHEDULE_CREATED",
        {"schedule_id": schedule_id, "class_name": payload.class_name, "subject": payload.subject_name},
        request.client.host if request.client else ""
    )
    doc.pop("_id", None)
    return doc

@router.put("/teacher/schedules/{schedule_id}")
async def update_teacher_schedule(
    schedule_id: str,
    payload: UpdateSchedulePayload,
    request: Request,
    user: User = Depends(require_title("kurikulum"))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    schedule = await db.shared_schedules.find_one({"schedule_id": schedule_id, "institution_code": user.institution_code})
    if not schedule:
        raise HTTPException(404, "Jadwal tidak ditemukan")

    updates = {}
    if payload.class_name is not None:
        updates["class_name"] = payload.class_name
    if payload.day is not None:
        updates["day"] = payload.day
    if payload.start_time is not None:
        updates["start_time"] = payload.start_time
    if payload.end_time is not None:
        updates["end_time"] = payload.end_time
    if payload.subject_name is not None:
        updates["subject_name"] = payload.subject_name
    if payload.current_topic is not None:
        updates["current_topic"] = payload.current_topic

    if updates:
        await db.shared_schedules.update_one({"schedule_id": schedule_id}, {"$set": updates})
        await write_audit(
            user.user_id,
            "SHARED_SCHEDULE_UPDATED",
            {"schedule_id": schedule_id, "updates": updates},
            request.client.host if request.client else ""
        )

    updated_schedule = await db.shared_schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    return updated_schedule

@router.delete("/teacher/schedules/{schedule_id}")
async def delete_teacher_schedule(
    schedule_id: str,
    request: Request,
    user: User = Depends(require_title("kurikulum"))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    schedule = await db.shared_schedules.find_one({"schedule_id": schedule_id, "institution_code": user.institution_code})
    if not schedule:
        raise HTTPException(404, "Jadwal tidak ditemukan")

    await db.shared_schedules.delete_one({"schedule_id": schedule_id})
    await write_audit(
        user.user_id,
        "SHARED_SCHEDULE_DELETED",
        {"schedule_id": schedule_id, "class_name": schedule.get("class_name"), "subject": schedule.get("subject_name")},
        request.client.host if request.client else ""
    )
    return {"deleted": True, "schedule_id": schedule_id}

@router.put("/teacher/schedules/{schedule_id}/links")
async def link_schedule_resources(
    schedule_id: str,
    payload: LinkResourcesPayload,
    request: Request,
    user: User = Depends(require_pengajar)
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    schedule = await db.shared_schedules.find_one({"schedule_id": schedule_id, "institution_code": user.institution_code})
    if not schedule:
        raise HTTPException(404, "Jadwal tidak ditemukan")

    # Teachers can link content to their assigned classes/subjects
    # Teachers can link content to their assigned classes/subjects
    is_allowed = True
    if TeacherTitle.guru_kelas in user.all_titles and TeacherTitle.guru_pengajar in user.all_titles:
        is_class_match = (schedule.get("class_name") == user.assigned_class)
        is_subject_match = (schedule.get("subject_name") == user.assigned_subject)
        classes = list(getattr(user, "teaching_classes", []) or [])
        if classes and is_subject_match:
            is_subject_match = schedule.get("class_name") in classes
        is_allowed = is_class_match or is_subject_match
    elif TeacherTitle.guru_kelas in user.all_titles:
        is_allowed = (schedule.get("class_name") == user.assigned_class)
    elif TeacherTitle.guru_pengajar in user.all_titles:
        is_allowed = (schedule.get("subject_name") == user.assigned_subject)
        classes = list(getattr(user, "teaching_classes", []) or [])
        if classes and is_allowed:
            is_allowed = schedule.get("class_name") in classes

    if not is_allowed:
        raise HTTPException(403, "Anda tidak diperbolehkan melink resources ke jadwal ini")

    updates = {}
    if payload.validated_recap_id is not None:
        updates["validated_recap_id"] = payload.validated_recap_id
    if payload.published_quiz_id is not None:
        updates["published_quiz_id"] = payload.published_quiz_id

    if updates:
        await db.shared_schedules.update_one({"schedule_id": schedule_id}, {"$set": updates})
        await write_audit(
            user.user_id,
            "SHARED_SCHEDULE_LINKS_UPDATED",
            {"schedule_id": schedule_id, "links": updates},
            request.client.host if request.client else ""
        )

    updated_schedule = await db.shared_schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    return updated_schedule
