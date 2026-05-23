import uuid
import logging
from datetime import datetime, timezone
from core.database import db

logger = logging.getLogger(__name__)

async def provision_for_class(student_id: str, class_token_doc: dict):
    """
    Idempotently syncs/provisions subjects, folders, and schedules for an autopilot student.
    """
    inst_code = class_token_doc.get("institution_code")
    target_class = class_token_doc["target_class_room"]

    if inst_code:
        # 1. Fetch all shared schedules for this class
        shared_schedules = await db.shared_schedules.find({
            "institution_code": inst_code,
            "class_name": target_class
        }).to_list(1000)

        # 2. Get unique subject names
        unique_subjects = sorted(list(set(s["subject_name"] for s in shared_schedules if s.get("subject_name"))))
    else:
        # Guru Mandiri (Pribadi): no schedules. Gather subjects from published docs/quizzes.
        shared_schedules = []
        teacher_id = class_token_doc.get("created_by_user_id")
        
        docs = await db.documents.find({
            "user_id": teacher_id,
            "status": "published",
            "target_class_room": target_class
        }).to_list(1000)
        
        quizzes = await db.quizzes.find({
            "user_id": teacher_id,
            "status": "published",
            "class_name": target_class
        }).to_list(1000)
        
        subjects_set = set()
        for d in docs:
            if d.get("subject_name"):
                subjects_set.add(d["subject_name"].strip())
        for q in quizzes:
            if q.get("subject_name"):
                subjects_set.add(q["subject_name"].strip())
        unique_subjects = sorted(list(subjects_set))

    # 3. Provision folders and build maps
    subject_to_folder = {}
    subject_to_id = {}
    
    # Fetch existing subjects from user's current doc to preserve subject_id if they already exist
    student_doc = await db.users.find_one({"user_id": student_id}, {"subjects": 1})
    existing_subjects = student_doc.get("subjects") or []
    existing_subj_map = {s["name"].strip().lower(): s for s in existing_subjects if s.get("name")}

    for name in unique_subjects:
        name_clean = name.strip()
        name_lower = name_clean.lower()
        
        # Determine subject_id (reuse if exists)
        if name_lower in existing_subj_map:
            subject_id = existing_subj_map[name_lower]["id"]
            folder_id = existing_subj_map[name_lower].get("folder_id")
        else:
            subject_id = f"subj_{uuid.uuid4().hex[:12]}"
            folder_id = None
            
        # If no folder_id, check if folder already exists in DB
        if not folder_id:
            existing_folder = await db.folders.find_one({
                "user_id": student_id,
                "name": name_clean,
                "status": {"$ne": "deleted"}
            }, {"_id": 0, "folder_id": 1})
            
            if existing_folder:
                folder_id = existing_folder["folder_id"]
            else:
                folder_id = uuid.uuid4().hex
                await db.folders.insert_one({
                    "folder_id": folder_id,
                    "user_id": student_id,
                    "name": name_clean,
                    "status": "active",
                    "source": "institution",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
        
        subject_to_folder[name_clean] = folder_id
        subject_to_id[name_clean] = subject_id

    # 4. Construct student's subjects array
    subjects_out = []
    for name in unique_subjects:
        subjects_out.append({
            "id": subject_to_id[name],
            "name": name,
            "folder_id": subject_to_folder[name]
        })

    # 5. Construct student's schedule array
    schedule_out = []
    for item in shared_schedules:
        subj_name = item["subject_name"]
        subj_id = subject_to_id.get(subj_name)
        if subj_id:
            schedule_out.append({
                "day": item["day"],
                "start_time": item["start_time"],
                "end_time": item["end_time"],
                "subject_id": subj_id
            })

    # 6. Update user's profile with new subjects and schedules
    await db.users.update_one(
        {"user_id": student_id},
        {"$set": {
            "subjects": subjects_out,
            "schedule": schedule_out
        }}
    )
    logger.info(f"Successfully provisioned/synced {len(subjects_out)} subjects for student {student_id}")
