import logging
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User
from deps.auth import get_current_user, require_pelajar
from services.sync_service import provision_for_class

logger = logging.getLogger(__name__)
router = APIRouter()

DAYS_MAP = {
    0: "Senin",
    1: "Selasa",
    2: "Rabu",
    3: "Kamis",
    4: "Jumat",
    5: "Sabtu",
    6: "Minggu"
}

@router.get("/schedule/sync")
async def sync_schedule(user: User = Depends(require_pelajar)):
    if not user.class_token_used or not user.enrolled_class:
        raise HTTPException(400, "User tidak terdaftar dalam kelas institusi")

    token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
    if not token_doc:
        raise HTTPException(404, "Data token kelas tidak ditemukan")

    await provision_for_class(user.user_id, token_doc)

    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "subjects": 1, "schedule": 1})
    return {
        "subjects": updated_user.get("subjects") or [],
        "schedule": updated_user.get("schedule") or []
    }

@router.get("/learner/today")
async def get_learner_today(day: Optional[str] = None, user: User = Depends(require_pelajar)):
    if not day:
        # Determine Indonesian day name for today
        weekday = datetime.datetime.now().weekday()
        day = DAYS_MAP[weekday]

    day = day.strip().capitalize()

    # Map student subjects to folders
    subject_folder_map = {}
    subject_id_map = {}
    for s in (user.subjects or []):
        if s.get("name"):
            subject_folder_map[s["name"].strip().lower()] = s.get("folder_id")
            subject_id_map[s["name"].strip().lower()] = s.get("id")

    if user.enrolled_class:
        if user.institution_code:
            # Autopilot Student (Enterprise): fetch from shared_schedules
            schedules = await db.shared_schedules.find({
                "institution_code": user.institution_code,
                "class_name": user.enrolled_class,
                "day": day
            }).sort("start_time", 1).to_list(200)

            out = []
            for s in schedules:
                subj_name = s.get("subject_name", "")
                subj_lower = subj_name.strip().lower()
                out.append({
                    "day": s["day"],
                    "start_time": s["start_time"],
                    "end_time": s["end_time"],
                    "subject_name": subj_name,
                    "current_topic": s.get("current_topic"),
                    "validated_recap_id": s.get("validated_recap_id"),
                    "published_quiz_id": s.get("published_quiz_id"),
                    "folder_id": subject_folder_map.get(subj_lower),
                    "subject_id": subject_id_map.get(subj_lower)
                })
            return out
        else:
            # Autopilot Student (Guru Mandiri): no timetabled schedules
            return []
    else:
        # Independent Student: filter user.schedule
        local_schedules = user.schedule or []
        out = []
        for s in local_schedules:
            if s.get("day") == day:
                # Find matching subject name
                subj_name = ""
                folder_id = None
                for sub in (user.subjects or []):
                    if sub.get("id") == s.get("subject_id"):
                        subj_name = sub.get("name", "")
                        folder_id = sub.get("folder_id")
                        break
                out.append({
                    "day": s["day"],
                    "start_time": s["start_time"],
                    "end_time": s["end_time"],
                    "subject_name": subj_name,
                    "subject_id": s.get("subject_id"),
                    "folder_id": folder_id
                })
        # Sort by start_time
        out.sort(key=lambda x: x.get("start_time", ""))
        return out

@router.get("/learner/subjects/{folder_id}/materials")
async def list_subject_materials(folder_id: str, user: User = Depends(require_pelajar)):
    folder = await db.folders.find_one({"folder_id": folder_id, "user_id": user.user_id, "status": {"$ne": "deleted"}})
    if not folder:
        raise HTTPException(404, "Folder tidak ditemukan")

    # Find matching subject_id
    subject_id = None
    for s in (user.subjects or []):
        if s.get("folder_id") == folder_id:
            subject_id = s.get("id")
            break

    # Get private documents
    private_docs = await db.documents.find({
        "user_id": user.user_id,
        "folder_id": folder_id,
        "status": {"$ne": "deleted"}
    }, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(500)

    # Get institutional published documents
    inst_docs = []
    if user.institution_code:
        inst_docs = await db.documents.find({
            "institution_code": user.institution_code,
            "subject_name": folder["name"],
            "visibility": "institution",
            "status": "published"
        }, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(500)
    elif user.class_token_used:
        # Guru Mandiri fallback
        token_doc = await db.class_tokens.find_one({"class_token": user.class_token_used})
        if token_doc:
            inst_docs = await db.documents.find({
                "user_id": token_doc["created_by_user_id"],
                "target_class_room": token_doc["target_class_room"],
                "subject_name": folder["name"],
                "status": "published"
            }, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(500)

    # Map local folder_id and subject_id dynamically
    for doc in inst_docs:
        doc["folder_id"] = folder_id
        doc["subject_id"] = subject_id

    # Combine both and sort by created_at desc
    combined = private_docs + inst_docs
    combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # De-duplicate by document_id
    seen = set()
    unique_materials = []
    for m in combined:
        m_id = m.get("document_id")
        if m_id not in seen:
            seen.add(m_id)
            unique_materials.append(m)

    return {"materials": unique_materials}


class JoinClassPayload(BaseModel):
    class_token: str


@router.post("/student/join-class")
async def join_class(payload: JoinClassPayload, request: Request, user: User = Depends(require_pelajar)):
    token = payload.class_token.strip()
    if not token:
        raise HTTPException(400, "Token kelas wajib diisi")

    token_doc = await db.class_tokens.find_one({"class_token": token})
    if not token_doc:
        raise HTTPException(404, "Token kelas tidak ditemukan")

    inst_code = token_doc.get("institution_code")
    target_class = token_doc["target_class_room"]
    level = token_doc["level"]
    semester = token_doc["target_semester_or_grade"]
    major = token_doc.get("major")

    institution_doc = None
    if inst_code:
        institution_doc = await db.institutions.find_one({"institution_code": inst_code})
    
    inst_name = institution_doc.get("name") if institution_doc else ""

    # Ensure institutional students have a major for SMA-equivalent levels.
    # Prefer token.major, then institution.major. If still missing, block join to avoid incomplete academic profile.
    sma_equiv = {"SMA", "SMK", "MA"}
    if level in sma_equiv and not major:
        major = institution_doc.get("major") if institution_doc else None
        if not major:
            raise HTTPException(
                400,
                "Jurusan wajib diisi untuk jenjang SMA/SMK/MA. "
                "Silakan minta admin/kepsek membuat ulang token kelas dengan jurusan, atau lengkapi jurusan institusi."
            )

    active_year = None
    if inst_code:
        active_year = await db.academic_years.find_one({"institution_code": inst_code, "is_active": True})

    updates = {
        "institution_code": inst_code,
        "class_token_used": token,
        "enrolled_class": target_class,
        "education_level": level,
        "current_semester": semester,
        "institution": inst_name,
        "major": major,
        "account_type": "perusahaan" if inst_code else "pribadi"
    }
    if active_year:
        updates["academic_year_id"] = active_year.get("academic_year_id")

    await db.users.update_one({"user_id": user.user_id}, {"$set": updates})

    # Run class provisioning to auto sync subjects & folders
    await provision_for_class(user.user_id, token_doc)

    from deps.auth import write_audit
    await write_audit(user.user_id, "CLASS_JOINED", {"class_token": token, "class_name": target_class}, request.client.host if request.client else "")

    return {"status": "success", "message": f"Berhasil bergabung ke kelas {target_class}"}
