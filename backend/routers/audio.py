from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from core.config import AUDIO_DIR

router = APIRouter()

@router.get("/audio/{filename}")
async def serve_audio(filename: str):
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "Audio tidak ditemukan")
    return FileResponse(str(file_path), media_type="audio/wav")
