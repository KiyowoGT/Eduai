import random
import string
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

class CreatePasscodePayload(BaseModel):
    title: TeacherTitle
    assigned_class: Optional[str] = None
    assigned_subject: Optional[str] = None

@router.post("/staff/passcodes")
async def generate_passcode(
    payload: CreatePasscodePayload,
    request: Request,
    user: User = Depends(require_title("kepala_sekolah"))
):
    if not user.institution_code:
        raise HTTPException(400, "User tidak terhubung ke institusi manapun")

    # Validations based on title
    if payload.title == TeacherTitle.guru_kelas and not payload.assigned_class:
        raise HTTPException(400, "Wali kelas wajib memiliki kelas yang ditugaskan (assigned_class)")
    if payload.title == TeacherTitle.guru_pengajar and not payload.assigned_subject:
        raise HTTPException(400, "Guru mata pelajaran wajib memiliki mata pelajaran yang ditugaskan (assigned_subject)")

    prefix_map = {
        TeacherTitle.kepala_sekolah: "KPS",
        TeacherTitle.kurikulum: "KRL",
        TeacherTitle.guru_kelas: "GKL",
        TeacherTitle.guru_pengajar: "GPJ"
    }
    prefix = prefix_map.get(payload.title, "GUR")

    passcode = None
    for attempt in range(10):
        rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        pcode = f"{user.institution_code}-{prefix}-{rand_suffix}"
        try:
            doc = {
                "passcode": pcode,
                "institution_code": user.institution_code,
                "title": payload.title.value if hasattr(payload.title, "value") else payload.title,
                "assigned_class": payload.assigned_class,
                "assigned_subject": payload.assigned_subject,
                "created_by_user_id": user.user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.staff_passcodes.insert_one(doc.copy())
            passcode = doc
            break
        except Exception as e:
            if "11000" in str(e) and attempt < 9:
                continue
            raise HTTPException(500, "Gagal membuat passcode unik. Silakan coba lagi.")

    if not passcode:
        raise HTTPException(500, "Gagal membuat passcode.")

    await write_audit(
        user.user_id,
        "STAFF_PASSCODE_GENERATED",
        {"passcode": passcode["passcode"], "title": payload.title},
        request.client.host if request.client else ""
    )
    passcode.pop("_id", None)
    return passcode

@router.get("/institutions/me")
async def get_my_institution(user: User = Depends(require_pengajar)):
    if not user.institution_code:
        raise HTTPException(404, "User tidak terhubung ke institusi")

    institution = await db.institutions.find_one({"institution_code": user.institution_code}, {"_id": 0})
    if not institution:
        raise HTTPException(404, "Institusi tidak ditemukan")

    passcodes = await db.staff_passcodes.find({"institution_code": user.institution_code}, {"_id": 0}).to_list(200)

    # Mask passcodes if user is not kepala_sekolah
    is_admin = "kepala_sekolah" in [t.value if hasattr(t, "value") else t for t in user.all_titles]
    for pc in passcodes:
        if not is_admin:
            pc["passcode"] = "********"

    return {
        "institution": institution,
        "passcodes": passcodes
    }

@router.get("/institutions/validate")
async def validate_institution(institution_code: str):
    code = institution_code.strip()
    if not code:
        raise HTTPException(400, "Kode institusi tidak boleh kosong")

    inst = await db.institutions.find_one({"institution_code": code}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Institusi tidak ditemukan")

    return {
        "valid": True,
        "name": inst["name"],
        "level": inst["level"],
        "major": inst.get("major")
    }

@router.get("/staff/passcodes/validate")
async def validate_passcode(passcode: str):
    pcode = passcode.strip()
    if not pcode:
        raise HTTPException(400, "Passcode tidak boleh kosong")

    pc_doc = await db.staff_passcodes.find_one({"passcode": pcode}, {"_id": 0})
    if not pc_doc:
        raise HTTPException(404, "Passcode staff tidak ditemukan")

    inst = await db.institutions.find_one({"institution_code": pc_doc["institution_code"]})
    inst_name = inst["name"] if inst else ""

    return {
        "valid": True,
        "title": pc_doc["title"],
        "assigned_class": pc_doc.get("assigned_class"),
        "assigned_subject": pc_doc.get("assigned_subject"),
        "institution_name": inst_name,
        "institution_code": pc_doc["institution_code"]
    }
