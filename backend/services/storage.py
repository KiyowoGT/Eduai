import logging
import httpx
from typing import Optional
from core.config import SUPABASE_URL, SUPABASE_ANON_KEY
from core.database import db

SUPABASE_STORAGE_URL = f"{SUPABASE_URL}/storage/v1" if SUPABASE_URL else ""

logger = logging.getLogger(__name__)

async def upload_to_supabase_storage(user_id: str, document_id: str, file_path: str) -> Optional[str]:
    if not SUPABASE_STORAGE_URL:
        return None
    storage_path = f"{user_id}/{document_id}.pdf"
    try:
        with open(file_path, "rb") as f:
            content = f.read()
        async with httpx.AsyncClient(timeout=30.0) as hc:
            r = await hc.post(
                f"{SUPABASE_STORAGE_URL}/object/pdf/{storage_path}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "Content-Type": "application/pdf",
                },
                content=content,
            )
            if r.status_code not in (200, 201):
                logger.warning(f"Supabase storage upload failed: {r.status_code} {r.text[:200]}")
                return None
        return f"{SUPABASE_STORAGE_URL}/object/public/pdf/{storage_path}"
    except Exception as e:
        logger.warning(f"Supabase storage upload error: {e}")
        return None

async def delete_from_supabase_storage(user_id: str, document_id: str):
    if not SUPABASE_STORAGE_URL:
        return
    storage_path = f"{user_id}/{document_id}.pdf"
    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            await hc.delete(
                f"{SUPABASE_STORAGE_URL}/object/pdf/{storage_path}",
                headers={"Authorization": f"Bearer {SUPABASE_ANON_KEY}"},
            )
    except Exception as e:
        logger.warning(f"Supabase storage delete error: {e}")

async def try_upload_supabase(user_id: str, doc_id: str, file_path: str):
    try:
        url = await upload_to_supabase_storage(user_id, doc_id, file_path)
        if url:
            await db.documents.update_one(
                {"document_id": doc_id},
                {"$set": {"pdf_url": url}},
            )
    except Exception as e:
        logger.warning(f"Supabase background upload skipped: {e}")
