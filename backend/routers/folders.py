import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request

from core.database import db
from models.user import User
from models.folder import FolderCreate, FolderUpdate
from deps.auth import get_current_user, write_audit

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/folders")
async def folder_create(request: Request, payload: FolderCreate, user: User = Depends(get_current_user)):
    if user.role == "pelajar" and user.account_type == "perusahaan":
        raise HTTPException(403, "Pelajar institusi tidak dapat membuat folder secara mandiri. Gunakan struktur materi dari guru.")

    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nama folder wajib")
    existing = await db.folders.find_one({"user_id": user.user_id, "name": name, "status": {"$ne": "deleted"}}, {"_id": 0, "folder_id": 1})
    if existing:
        raise HTTPException(409, "Nama folder sudah dipakai")
    folder_id = uuid.uuid4().hex
    doc = {
        "folder_id": folder_id,
        "user_id": user.user_id,
        "name": name,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.folders.insert_one(doc.copy())
    await write_audit(user.user_id, "FOLDER_CREATED", {"folder_id": folder_id, "name": name}, request.client.host if request.client else "")
    doc.pop("_id", None)
    return {**doc, "document_count": 0}


@router.get("/folders")
async def folder_list(user: User = Depends(get_current_user)):
    folders = await db.folders.find({"user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for f in folders:
        private_count = await db.documents.count_documents({"user_id": user.user_id, "folder_id": f["folder_id"]})
        if user.role == "pelajar" and user.institution_code:
            subjects = user.subjects or []
            folder_subj_names = []
            for s in subjects:
                s_name = s.get("name", "")
                s_folder = s.get("folder_id")
                if s_name:
                    s_name_clean = s_name.strip()
                    if s_folder == f["folder_id"] or s_name_clean.lower() == f["name"].strip().lower():
                        folder_subj_names.append(s_name)
            if not folder_subj_names:
                folder_subj_names = [f["name"]]
            
            inst_count = await db.documents.count_documents({
                "institution_code": user.institution_code,
                "subject_name": {"$in": folder_subj_names},
                "visibility": "institution",
                "status": "published"
            })
            f["document_count"] = private_count + inst_count
        else:
            f["document_count"] = private_count
    return folders


@router.get("/folders/{folder_id}")
async def folder_get(folder_id: str, user: User = Depends(get_current_user)):
    folder = await db.folders.find_one({"folder_id": folder_id, "user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder tidak ditemukan")
    
    docs = await db.documents.find({"user_id": user.user_id, "folder_id": folder_id}, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(500)
    
    if user.role == "pelajar" and user.institution_code:
        subjects = user.subjects or []
        folder_subj_names = []
        name_to_folder = {}
        name_to_subject_id = {}
        for s in subjects:
            s_name = s.get("name", "")
            s_folder = s.get("folder_id")
            s_id = s.get("id")
            if s_name:
                s_name_clean = s_name.strip()
                name_to_folder[s_name_clean.lower()] = s_folder
                name_to_subject_id[s_name_clean.lower()] = s_id
                if s_folder == folder_id or s_name_clean.lower() == folder["name"].strip().lower():
                    folder_subj_names.append(s_name)
        
        if not folder_subj_names:
            folder_subj_names = [folder["name"]]
            name_to_folder[folder["name"].strip().lower()] = folder_id

        inst_docs = await db.documents.find({
            "institution_code": user.institution_code,
            "subject_name": {"$in": folder_subj_names},
            "visibility": "institution",
            "status": "published"
        }, {"_id": 0, "file_path": 0}).sort("created_at", -1).to_list(500)

        for doc in inst_docs:
            subj_name = doc.get("subject_name", "")
            subj_lower = subj_name.strip().lower()
            doc["folder_id"] = folder_id
            doc["subject_id"] = name_to_subject_id.get(subj_lower)
            
        docs.extend(inst_docs)
        seen = set()
        unique_docs = []
        for d in docs:
            d_id = d.get("document_id")
            if d_id not in seen:
                seen.add(d_id)
                unique_docs.append(d)
        docs = unique_docs
        docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    folder_doc_ids = [d["document_id"] for d in docs]
    recaps = await db.recaps.find({
        "user_id": user.user_id,
        "$or": [
            {"folder_id": folder_id},
            {"document_ids": {"$in": folder_doc_ids}},
        ]
    }, {"_id": 0, "unified_summary": 0, "per_document": 0, "shared_concepts": 0, "study_path": 0}).sort("created_at", -1).to_list(50)
    folder["documents"] = docs
    folder["recaps"] = recaps
    folder["document_count"] = len(docs)
    return folder


@router.put("/folders/{folder_id}")
async def folder_update(request: Request, folder_id: str, payload: FolderUpdate, user: User = Depends(get_current_user)):
    folder = await db.folders.find_one({"folder_id": folder_id, "user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder tidak ditemukan")
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nama folder wajib")
    duplicate = await db.folders.find_one({"user_id": user.user_id, "name": name, "status": {"$ne": "deleted"}, "folder_id": {"$ne": folder_id}}, {"_id": 0, "folder_id": 1})
    if duplicate:
        raise HTTPException(409, "Nama folder sudah dipakai")
    await db.folders.update_one({"folder_id": folder_id}, {"$set": {"name": name}})
    await write_audit(user.user_id, "FOLDER_RENAMED", {"folder_id": folder_id, "name": name}, request.client.host if request.client else "")
    return {**folder, "name": name}


@router.delete("/folders/{folder_id}")
async def folder_delete(request: Request, folder_id: str, user: User = Depends(get_current_user)):
    """Soft-delete folder and move documents out of the folder."""
    folder = await db.folders.find_one({"folder_id": folder_id, "user_id": user.user_id, "status": {"$ne": "deleted"}}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder tidak ditemukan")

    result = await db.documents.update_many(
        {"user_id": user.user_id, "folder_id": folder_id},
        {"$unset": {"folder_id": ""}},
    )

    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "subjects": 1})
    subjects = user_doc.get("subjects") if user_doc else []
    if subjects:
        patched_subjects = []
        changed = False
        for subj in subjects:
            item = dict(subj)
            if item.get("folder_id") == folder_id:
                item["folder_id"] = None
                changed = True
            patched_subjects.append(item)
        if changed:
            await db.users.update_one({"user_id": user.user_id}, {"$set": {"subjects": patched_subjects}})

    await db.folders.update_one(
        {"folder_id": folder_id, "user_id": user.user_id},
        {"$set": {"status": "deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    await write_audit(user.user_id, "FOLDER_DELETED", {"folder_id": folder_id, "name": folder.get("name"), "documents_moved_out": result.modified_count}, request.client.host if request.client else "")
    return {"folder_id": folder_id, "deleted": True, "documents_moved_out": result.modified_count, "soft_deleted": True}
