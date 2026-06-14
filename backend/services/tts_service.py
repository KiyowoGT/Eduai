import os
import re
import logging
import asyncio
import httpx
from typing import Optional
from fastapi import HTTPException

from core.config import AUDIO_DIR
from models.user import User

logger = logging.getLogger(__name__)

_TTS_LOCK = asyncio.Lock()
_TTS_VOICE = "id-ID-GadisNeural"
_SYMBOLS_RE = re.compile(r'[*#_~`^\\\[\]<>{}|@$%&+=/]')

def _clean_tts_text(text: str) -> str:
    return _SYMBOLS_RE.sub("", text).strip()


async def _generate_tts(text: str, output_path: str, user: Optional[User] = None):
    cleaned = _clean_tts_text(text)
    if not cleaned:
        raise HTTPException(400, "Teks kosong setelah dibersihkan")
        
    use_cloning = True
    voice_model = "moona" # default RVC model
    
    if user:
        if getattr(user, "clone_voice_enabled", None) is False:
            use_cloning = False
        # Map user preference to holo model if available
        pref_model = getattr(user, "clone_voice_url", None) or "moona"
        if isinstance(pref_model, str):
            pref_model = pref_model.lower().strip()
            # simple mapping for ease of use
            for m in ['moona', 'lofi', 'risu', 'ollie', 'anya', 'reine', 'zeta', 'kaela', 'kobo']:
                if m in pref_model:
                    voice_model = m
                    break
        
    if use_cloning:
        async def _try_rvcholo():
            try:
                # 1. Generate normal TTS first using edge-tts as baseline audio
                temp_tts_path = output_path + ".temp.mp3"
                import edge_tts
                communicate = edge_tts.Communicate(cleaned, _TTS_VOICE)
                await communicate.save(temp_tts_path)
                
                # Read baseline audio to buffer
                with open(temp_tts_path, "rb") as f:
                    audio_buffer = f.read()
                
                # Cleanup temp file
                if os.path.exists(temp_tts_path):
                    os.remove(temp_tts_path)

                # 2. Upload to kit-lemonfoot-vtuber-rvc-models space
                api_url = "https://kit-lemonfoot-vtuber-rvc-models.hf.space"
                file_url = "https://kit-lemonfoot-vtuber-rvc-models.hf.space/file="
                
                models = {
                    "moona": ["Moona Hoshinova", "weights/hololive-id/Moona/Moona_Megaaziib.pth", "weights/hololive-id/Moona/added_IVF1259_Flat_nprobe_1_v2_mbkm.index", ""],
                    "lofi": ["Airani Iofifteen", "weights/hololive-id/Iofi/Iofi_KitLemonfoot.pth", "weights/hololive-id/Iofi/added_IVF256_Flat_nprobe_1_AiraniIofifteen_Speaking_V2_v2.index", ""],
                    "risu": ["Ayunda Risu", "weights/hololive-id/Risu/Risu_Megaaziib.pth", "weights/hololive-id/Risu/added_IVF2090_Flat_nprobe_1_v2_mbkm.index", ""],
                    "ollie": ["Kureiji Ollie", "weights/hololive-id/Ollie/Ollie_Dacoolkid.pth", "weights/hololive-id/Ollie/added_IVF2227_Flat_nprobe_1_ollie_v2_mbkm.index", ""],
                    "anya": ["Anya Melfissa", "weights/hololive-id/Anya/Anya_Megaaziib.pth", "weights/hololive-id/Anya/added_IVF910_Flat_nprobe_1_anyav2_v2_mbkm.index", ""],
                    "reine": ["Pavolia Reine", "weights/hololive-id/Reine/Reine_KitLemonfoot.pth", "weights/hololive-id/Reine/added_IVF256_Flat_nprobe_1_PavoliaReine_Speaking_KitLemonfoot_v2.index", ""],
                    "zeta": ["Vestia Zeta", "weights/hololive-id/Zeta/Zeta_Megaaziib.pth", "weights/hololive-id/Zeta/added_IVF462_Flat_nprobe_1_zetav2_v2.index", ""],
                    "kaela": ["Kaela Kovalskia", "weights/hololive-id/Kaela/Kaela_Megaaziib.pth", "weights/hololive-id/Kaela/added_IVF265_Flat_nprobe_1_kaelaV2_v2.index", ""],
                    "kobo": ["Kobo Kanaeru", "weights/hololive-id/Kobo/Kobo_Megaaziib.pth", "weights/hololive-id/Kobo/added_IVF454_Flat_nprobe_1_kobov2_v2.index", ""]
                }
                
                fn_indices = {
                    "moona": 44,
                    "lofi": 45,
                    "risu": 46,
                    "ollie": 47,
                    "anya": 48,
                    "reine": 49,
                    "zeta": 50,
                    "kaela": 51,
                    "kobo": 52
                }

                import string
                import random
                def generate_session():
                    return "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
                
                session_hash = generate_session()
                upload_id = generate_session()
                orig_name = f"rynn_{int(asyncio.get_event_loop().time())}.mp3"
                
                logger.info(f"RVC Holo ID: Uploading baseline TTS to HuggingFace space using model {voice_model}")
                
                # Upload request using httpx
                async with httpx.AsyncClient(timeout=180.0) as client:
                    files = {"files": (orig_name, audio_buffer, "audio/mpeg")}
                    upload_resp = await client.post(
                        f"{api_url}/upload?upload_id={upload_id}",
                        files=files
                    )
                    upload_resp.raise_for_status()
                    uploaded_paths = upload_resp.json()
                    uploaded_path = uploaded_paths[0]
                    
                    audio_payload = {
                        "path": uploaded_path,
                        "url": f"{file_url}{uploaded_path}",
                        "orig_name": orig_name,
                        "size": len(audio_buffer),
                        "mime_type": "audio/mpeg",
                        "meta": {"_type": "gradio.FileData"}
                    }
                    
                    # Gradio queue join
                    logger.info(f"RVC Holo ID: Submitting conversion request (Session: {session_hash})")
                    join_resp = await client.post(
                        f"{api_url}/queue/join?session_hash={session_hash}",
                        json={
                            "data": [
                                *models[voice_model],
                                audio_payload,
                                "",
                                "English-Ana (Female)",
                                0, # transpose
                                "pm",
                                0.4,
                                1,
                                0,
                                1,
                                0.23
                            ],
                            "event_data": None,
                            "fn_index": fn_indices[voice_model],
                            "trigger_id": 620,
                            "session_hash": session_hash
                        }
                    )
                    join_resp.raise_for_status()
                    
                    # Poll queue data
                    logger.info("RVC Holo ID: Polling result from Gradio queue...")
                    data_resp = await client.get(
                        f"{api_url}/queue/data?session_hash={session_hash}"
                    )
                    data_resp.raise_for_status()
                    
                    result_url = None
                    lines = data_resp.text.split("\n\n")
                    for line in lines:
                        if line.startswith("data:"):
                            try:
                                import json
                                d = json.loads(line[5:])
                                if d.get("msg") == "process_completed":
                                    result_url = d["output"]["data"][1]["url"]
                                    break
                            except Exception:
                                pass
                                
                    if result_url:
                        if result_url.startswith("/"):
                            result_url = f"{api_url}{result_url}"
                        logger.info(f"RVC Holo ID: Successfully generated audio! Downloading from: {result_url}")
                        audio_resp = await client.get(result_url)
                        audio_resp.raise_for_status()
                        return audio_resp.content
                    else:
                        logger.error("RVC Holo ID: No process_completed message found in queue response.")
                        
            except Exception as e:
                logger.exception(f"RVC Holo ID failed: {e}")
            return None

        audio_content = await _try_rvcholo()
        if audio_content:
            with open(output_path, "wb") as f:
                f.write(audio_content)
            return
        else:
            logger.error("RVC Holo ID failed to generate audio. Falling back to default edge-tts.")

    # Default edge-tts neural voice fallback (fast and instant)
    import edge_tts
    communicate = edge_tts.Communicate(cleaned, _TTS_VOICE)
    await communicate.save(output_path)
