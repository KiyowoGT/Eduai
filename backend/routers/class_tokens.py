import random
import string
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from models.user import User, TeacherTitle, AccountType
from deps.auth import get_current_user, require_pengajar, require_title, write_audit

logger = logging.getLogger(__name__)
router = APIRouter()

class CreateClassTokenPayload(BaseModel):
    target_class_room: str
    target_semester_or_grade: int
    major: Optional[str] = None

async def require_can_create_token(user: User = Depends(require_pengajar)) -> User:
    is_guru_kelas = TeacherTitle.guru_kelas in user.all_titles
    is_guru_pengajar = TeacherTitle.guru_pengajar in user.all_titles
    is_mandiri = user.account_type == AccountType.pribadi
    if not (is_guru_kelas or is_guru_pengajar or is_mandiri):
        raise HTTPException(
            403,
            "Hanya Guru Kelas, Guru Pengajar, atau Guru Mandiri yang bisa membuat token kelas."
        )
    return user

@router.post("/class-tokens")
async def create_class_token(
    payload: CreateClassTokenPayload,
    request: Request,
    user: User = Depends(require_can_create_token)
):
    if user.account_type != AccountType.pribadi:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        
        is_guru_kelas = TeacherTitle.guru_kelas in user.all_titles
        is_guru_pengajar = TeacherTitle.guru_pengajar in user.all_titles
        is_admin_or_kuri = any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum))
        
        if not is_admin_or_kuri:
            allowed_classes = []
            if is_guru_kelas and user.assigned_class:
                allowed_classes.append(user.assigned_class)
            if is_guru_pengajar:
                allowed_classes.extend(list(getattr(user, "teaching_classes", []) or []))
            
            if allowed_classes and payload.target_class_room not in allowed_classes:
                raise HTTPException(403, f"Akses ditolak: Anda hanya diperbolehkan membuat token untuk kelas: {', '.join(allowed_classes)}")

    # Generate token: e.g., INSTCODE-CLASS-RAND or MANDIRI-CLASS-RAND
    if user.account_type == AccountType.pribadi:
        inst_clean = "MANDIRI"
    else:
        inst_clean = "".join([c for c in user.institution_code if c.isalnum()]).upper()
        
    class_clean = "".join([c for c in payload.target_class_room if c.isalnum()]).upper()
    
    token = None
    for attempt in range(10):
        rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        ctoken = f"{inst_clean}-{class_clean}-{rand_suffix}"
        try:
            doc = {
                "class_token": ctoken,
                "institution_code": user.institution_code,
                "level": user.education_level,
                "target_class_room": payload.target_class_room,
                "target_semester_or_grade": payload.target_semester_or_grade,
                "major": payload.major,
                "created_by_user_id": user.user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.class_tokens.insert_one(doc.copy())
            token = doc
            break
        except Exception as e:
            if "11000" in str(e) and attempt < 9:
                continue
            raise HTTPException(500, "Gagal membuat token kelas unik. Silakan coba lagi.")

    if not token:
        raise HTTPException(500, "Gagal membuat token kelas.")

    await write_audit(
        user.user_id,
        "CLASS_TOKEN_CREATED",
        {"class_token": token["class_token"], "target_class_room": payload.target_class_room},
        request.client.host if request.client else ""
    )
    token.pop("_id", None)
    return token

@router.get("/class-tokens")
async def list_class_tokens(user: User = Depends(require_can_create_token)):
    if user.account_type == AccountType.pribadi:
        query = {"created_by_user_id": user.user_id}
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        
        is_guru_kelas = TeacherTitle.guru_kelas in user.all_titles
        is_guru_pengajar = TeacherTitle.guru_pengajar in user.all_titles
        is_admin_or_kuri = any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum))
        
        query = {"institution_code": user.institution_code}
        if not is_admin_or_kuri:
            allowed_classes = []
            if is_guru_kelas and user.assigned_class:
                allowed_classes.append(user.assigned_class)
            if is_guru_pengajar:
                allowed_classes.extend(list(getattr(user, "teaching_classes", []) or []))
            
            if allowed_classes:
                query["target_class_room"] = {"$in": allowed_classes}
        
    tokens = await db.class_tokens.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tokens

@router.delete("/class-tokens/{token}")
async def revoke_class_token(token: str, request: Request, user: User = Depends(require_can_create_token)):
    if user.account_type == AccountType.pribadi:
        token_doc = await db.class_tokens.find_one({"class_token": token, "created_by_user_id": user.user_id})
    else:
        if not user.institution_code:
            raise HTTPException(400, "User tidak terhubung ke institusi manapun")
        token_doc = await db.class_tokens.find_one({"class_token": token, "institution_code": user.institution_code})
        if token_doc:
            is_guru_kelas = TeacherTitle.guru_kelas in user.all_titles
            is_guru_pengajar = TeacherTitle.guru_pengajar in user.all_titles
            is_admin_or_kuri = any(t in user.all_titles for t in (TeacherTitle.kepala_sekolah, TeacherTitle.kurikulum))
            
            if not is_admin_or_kuri:
                allowed_classes = []
                if is_guru_kelas and user.assigned_class:
                    allowed_classes.append(user.assigned_class)
                if is_guru_pengajar:
                    allowed_classes.extend(list(getattr(user, "teaching_classes", []) or []))
                
                if allowed_classes and token_doc.get("target_class_room") not in allowed_classes:
                    raise HTTPException(403, "Anda tidak diperbolehkan menghapus token kelas ini")

    if not token_doc:
        raise HTTPException(404, "Token kelas tidak ditemukan")

    await db.class_tokens.delete_one({"class_token": token})
    await write_audit(
        user.user_id,
        "CLASS_TOKEN_REVOKED",
        {"class_token": token, "target_class_room": token_doc["target_class_room"]},
        request.client.host if request.client else ""
    )
    return {"deleted": True, "class_token": token}

@router.get("/class-tokens/validate")
async def validate_class_token(class_token: str):
    ctoken = class_token.strip()
    if not ctoken:
        raise HTTPException(400, "Token kelas tidak boleh kosong")

    token_doc = await db.class_tokens.find_one({"class_token": ctoken}, {"_id": 0})
    if not token_doc:
        raise HTTPException(404, "Token kelas tidak ditemukan")

    inst = await db.institutions.find_one({"institution_code": token_doc["institution_code"]})
    inst_name = inst["name"] if inst else ""

    return {
        "valid": True,
        "target_class_room": token_doc["target_class_room"],
        "target_semester_or_grade": token_doc["target_semester_or_grade"],
        "major": token_doc.get("major"),
        "institution_name": inst_name,
        "institution_code": token_doc["institution_code"],
        "level": token_doc["level"]
    }
