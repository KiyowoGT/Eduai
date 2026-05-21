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
    voice_url = None
    if user:
        if getattr(user, "clone_voice_enabled", None) is False:
            use_cloning = False
        voice_url = getattr(user, "clone_voice_url", None)
        
    if use_cloning:
        def _chunk_text(text_to_chunk, max_chars=120):
            words = text_to_chunk.split()
            if not words:
                return []
            chunks_list = []
            current_chunk = ""
            for word in words:
                candidate = (current_chunk + " " + word).strip() if current_chunk else word
                if len(candidate) > max_chars:
                    if current_chunk.strip():
                        chunks_list.append(current_chunk.strip())
                    current_chunk = word
                else:
                    current_chunk = candidate
            if current_chunk.strip():
                chunks_list.append(current_chunk.strip())
            return chunks_list

        def _concatenate_wavs(wav_contents):
            if not wav_contents:
                return b""
            if len(wav_contents) == 1:
                return wav_contents[0]
            first_wav = wav_contents[0]
            pcm_datas = [wav[44:] for wav in wav_contents]
            total_pcm_length = sum(len(pcm) for pcm in pcm_datas)
            import struct
            header = bytearray(first_wav[:44])
            header[4:8] = struct.pack("<I", total_pcm_length + 36)
            header[40:44] = struct.pack("<I", total_pcm_length)
            return bytes(header) + b"".join(pcm_datas)

        async def _try_chatterbox():
            local_default_path = os.path.abspath(
                os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    "frontend",
                    "public",
                    "suara",
                    "cara-membedakan-voice-changer-atau-murni-ala-miti-mythia-batford-aesood.wav"
                )
            )
            target_voice_url = voice_url or "https://eduai-deploy.vercel.app/suara/cara-membedakan-voice-changer-atau-murni-ala-miti-mythia-batford-aesood.wav"
            chunks = _chunk_text(cleaned, 120)
            logger.info(f"Split text into {len(chunks)} chunks for premium voice generation using {target_voice_url}")
            
            try:
                from gradio_client import Client
                logger.info("Using gradio_client to query Chatterbox AI.")
                
                def _gen_chunk_client(chunk_text: str, idx: int) -> Optional[bytes]:
                    try:
                        logger.info(f"Generating chunk {idx + 1}/{len(chunks)} with gradio_client: '{chunk_text}'")
                        client = Client("https://alstears-chatterbox-id-clone-api.hf.space")
                        
                        audio_file_param = None
                        audio_url_param = ""
                        
                        if voice_url:
                            if voice_url.startswith("http://") or voice_url.startswith("https://"):
                                audio_url_param = voice_url
                            elif os.path.exists(voice_url):
                                from gradio_client import handle_file
                                audio_file_param = handle_file(voice_url)
                            else:
                                audio_url_param = voice_url
                        else:
                            if os.path.exists(local_default_path):
                                from gradio_client import handle_file
                                audio_file_param = handle_file(local_default_path)
                            else:
                                audio_url_param = "https://eduai-deploy.vercel.app/suara/cara-membedakan-voice-changer-atau-murni-ala-miti-mythia-batford-aesood.wav"
                                
                        result_path = client.predict(
                            text=chunk_text,
                            audio_file=audio_file_param,
                            audio_url=audio_url_param,
                            api_name="/clone_voice"
                        )
                        logger.info(f"gradio_client generated chunk {idx + 1} at: {result_path}")
                        if result_path and os.path.exists(result_path):
                            with open(result_path, "rb") as f:
                                return f.read()
                        elif result_path and result_path.startswith("http"):
                            import requests
                            r = requests.get(result_path)
                            r.raise_for_status()
                            return r.content
                    except Exception as e:
                        logger.error(f"gradio_client failed on chunk {idx + 1}: {e}")
                    return None

                loop = asyncio.get_event_loop()
                tasks = [
                    loop.run_in_executor(None, _gen_chunk_client, chunk, idx)
                    for idx, chunk in enumerate(chunks)
                ]
                results = await asyncio.gather(*tasks)
                wav_results = [r for r in results if r is not None]
                if len(wav_results) == len(chunks):
                    logger.info(f"gradio_client successfully generated all {len(chunks)} chunks. Combining WAVs...")
                    return _concatenate_wavs(wav_results)
                logger.error(f"gradio_client generated only {len(wav_results)}/{len(chunks)} chunks. Falling back to HTTP client...")
            except ImportError:
                logger.info("gradio_client not installed. Falling back to HTTP client.")
            except Exception as e:
                logger.error(f"gradio_client setup failed: {e}. Falling back to HTTP client.")

            # Fallback raw HTTP client logic
            async def _gen_chunk(chunk: str, idx: int, client: httpx.AsyncClient) -> Optional[bytes]:
                try:
                    logger.info(f"Generating chunk {idx + 1}/{len(chunks)}: '{chunk}'")
                    submit_resp = await client.post(
                        "https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice",
                        json={"data": [chunk, None, target_voice_url]}
                    )
                    submit_resp.raise_for_status()
                    submit_data = submit_resp.json()
                    event_id = submit_data.get("event_id")
                    if not event_id:
                        logger.error(f"Gradio 6 submission failed to return event_id for chunk {idx + 1}: {submit_data}")
                        return None
                        
                    logger.info(f"Job submitted for chunk {idx + 1}. Event ID: {event_id}. Fetching stream...")
                    stream_resp = await client.get(
                        f"https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice/{event_id}"
                    )
                    stream_resp.raise_for_status()
                    stream_text = stream_resp.text
                    
                    error_match = re.search(r"event:\s*error\s*[\r\n]+data:\s*([^\r\n]+)", stream_text)
                    if error_match:
                        try:
                            import json
                            err_obj = json.loads(error_match.group(1))
                            if err_obj and "error" in err_obj:
                                logger.error(f"Gradio returned error for chunk {idx + 1}: {err_obj['error']}")
                        except Exception:
                            pass

                    matches = re.findall(r"data:\s*([^\r\n]+)", stream_text)
                    if not matches:
                        logger.error(f"No data events received in Gradio 6 stream for chunk {idx + 1}: {stream_text}")
                        return None
                        
                    for match in reversed(matches):
                        try:
                            import json
                            parsed = json.loads(match.strip())
                            if isinstance(parsed, list) and len(parsed) > 0:
                                audio_info = parsed[0]
                                audio_url = None
                                if isinstance(audio_info, dict):
                                    if "url" in audio_info:
                                        audio_url = audio_info["url"]
                                    elif "path" in audio_info:
                                        audio_url = f"https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/file={audio_info['path']}"
                                elif isinstance(audio_info, str):
                                    audio_url = audio_info
                                    
                                if audio_url:
                                    if audio_url.startswith("/"):
                                        audio_url = f"https://alstears-chatterbox-id-clone-api.hf.space{audio_url}"
                                    elif not audio_url.startswith("http"):
                                        audio_url = f"https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/file={audio_url}"
                                        
                                    logger.info(f"Downloading audio for chunk {idx + 1} from: {audio_url}")
                                    audio_resp = await client.get(audio_url)
                                    audio_resp.raise_for_status()
                                    return audio_resp.content
                        except Exception as parse_err:
                            logger.debug(f"Skipping unparseable stream data block: {parse_err}")
                except Exception as e:
                    logger.exception(f"Failed to generate chunk {idx + 1}: {e}")
                return None

            async with httpx.AsyncClient(timeout=180.0) as client:
                tasks = [_gen_chunk(chunk, idx, client) for idx, chunk in enumerate(chunks)]
                results = await asyncio.gather(*tasks)
                
            wav_results = [r for r in results if r is not None]
            if len(wav_results) == len(chunks):
                logger.info(f"Successfully generated all {len(chunks)} chunks. Combining WAVs...")
                return _concatenate_wavs(wav_results)
            logger.error(f"Generated only {len(wav_results)}/{len(chunks)} chunks successfully.")
            return None

        audio_content = await _try_chatterbox()
        if audio_content:
            with open(output_path, "wb") as f:
                f.write(audio_content)
            return
        else:
            logger.error("Chatterbox Gradio 6 failed to generate audio. Falling back to default TTS.")

    # Default edge-tts neural voice fallback (fast and instant)
    import edge_tts
    communicate = edge_tts.Communicate(cleaned, _TTS_VOICE)
    await communicate.save(output_path)
