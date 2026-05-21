import re

path = r"c:\Users\ganxa\Downloads\My Project\Eduai\backend\server.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

target = """    # Always attempt Chatterbox AI voice cloning with the premium voice
    if True:
        async def _try_chatterbox():
            premium_voice_url = "https://eduai-deploy.vercel.app/suara/voice_18-05-2026_14-06-54.ogg"
            try:
                logger.info(f"Calling Chatterbox Gradio 6 submission endpoint")
                async with httpx.AsyncClient(timeout=180.0) as client:
                    submit_resp = await client.post(
                        "https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice",
                        json={"data": [cleaned, None, premium_voice_url]}
                    )
                    submit_resp.raise_for_status()
                    submit_data = submit_resp.json()
                    event_id = submit_data.get("event_id")
                    if not event_id:
                        logger.error(f"Gradio 6 submission failed to return event_id: {submit_data}")
                        return None
                        
                    logger.info(f"Chatterbox job submitted successfully. Event ID: {event_id}. Fetching stream...")
                    stream_resp = await client.get(
                        f"https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice/{event_id}"
                    )
                    stream_resp.raise_for_status()
                    stream_text = stream_resp.text
                    
                    import re
                    matches = re.findall(r"data:\s*([^\r\n]+)", stream_text)
                    if not matches:
                        logger.error(f"No data events received in Gradio 6 stream: {stream_text}")
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
                                        
                                    logger.info(f"Downloading premium audio from: {audio_url}")
                                    audio_resp = await client.get(audio_url)
                                    audio_resp.raise_for_status()
                                    return audio_resp.content
                        except Exception as parse_err:
                            logger.debug(f"Skipping unparseable stream data block: {parse_err}")
            except Exception as e:
                logger.exception(f"Chatterbox Gradio 6 processing failed: {e}")
            return None

        audio_content = await _try_chatterbox()
        if audio_content:
            with open(output_path, "wb") as f:
                f.write(audio_content)
            return
        else:
            logger.error("Chatterbox Gradio 6 failed to generate audio. Falling back to default TTS.")"""

replacement = """    # Always attempt Chatterbox AI voice cloning with the premium voice
    if True:
        def _chunk_text(text_to_chunk, max_sentences=5, max_chars=200):
            import re
            sentences = re.findall(r'[^.!?\\n]+[.!?\\n]*|\\n+', text_to_chunk)
            if not sentences:
                return [text_to_chunk]
            chunks_list = []
            current_chunk = ""
            current_sentence_count = 0
            for sentence in sentences:
                trimmed = sentence.strip()
                if not trimmed:
                    continue
                if (current_sentence_count >= max_sentences or 
                    (len(current_chunk) + len(trimmed) > max_chars and len(current_chunk) > 0)):
                    chunks_list.append(current_chunk.strip())
                    current_chunk = ""
                    current_sentence_count = 0
                current_chunk += (" " if current_chunk else "") + trimmed
                current_sentence_count += 1
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
            premium_voice_url = "https://eduai-deploy.vercel.app/suara/voice_18-05-2026_14-06-54.ogg"
            chunks = _chunk_text(cleaned, 5, 200)
            logger.info(f"Split text into {len(chunks)} chunks for premium voice generation.")
            
            wav_results = []
            async with httpx.AsyncClient(timeout=180.0) as client:
                for idx, chunk in enumerate(chunks):
                    try:
                        logger.info(f"Generating chunk {idx + 1}/{len(chunks)}: '{chunk}'")
                        submit_resp = await client.post(
                            "https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice",
                            json={"data": [chunk, None, premium_voice_url]}
                        )
                        submit_resp.raise_for_status()
                        submit_data = submit_resp.json()
                        event_id = submit_data.get("event_id")
                        if not event_id:
                            logger.error(f"Gradio 6 submission failed to return event_id: {submit_data}")
                            return None
                            
                        logger.info(f"Job submitted. Event ID: {event_id}. Fetching stream...")
                        stream_resp = await client.get(
                            f"https://alstears-chatterbox-id-clone-api.hf.space/gradio_api/call/clone_voice/{event_id}"
                        )
                        stream_resp.raise_for_status()
                        stream_text = stream_resp.text
                        
                        # Check for Gradio stream errors
                        error_match = re.search(r"event:\s*error\s*\r?\ndata:\s*([^\r\n]+)", stream_text)
                        if error_match:
                            try:
                                import json
                                err_obj = json.loads(error_match.group(1))
                                if err_obj and "error" in err_obj:
                                    logger.error(f"Gradio returned error: {err_obj['error']}")
                            except Exception:
                                pass

                        matches = re.findall(r"data:\s*([^\r\n]+)", stream_text)
                        if not matches:
                            logger.error(f"No data events received in Gradio 6 stream: {stream_text}")
                            return None
                            
                        chunk_wav = None
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
                                            
                                        logger.info(f"Downloading audio from: {audio_url}")
                                        audio_resp = await client.get(audio_url)
                                        audio_resp.raise_for_status()
                                        chunk_wav = audio_resp.content
                                        break
                            except Exception as parse_err:
                                logger.debug(f"Skipping unparseable stream data block: {parse_err}")
                                
                        if chunk_wav:
                            wav_results.append(chunk_wav)
                        else:
                            logger.error(f"Failed to generate chunk {idx + 1}")
                            return None
                    except Exception as e:
                        logger.exception(f"Failed to generate chunk {idx + 1}: {e}")
                        return None
                        
            if len(wav_results) == len(chunks):
                logger.info(f"Successfully generated all {len(chunks)} chunks. Combining WAVs...")
                return _concatenate_wavs(wav_results)
            return None

        audio_content = await _try_chatterbox()
        if audio_content:
            with open(output_path, "wb") as f:
                f.write(audio_content)
            return
        else:
            logger.error("Chatterbox Gradio 6 failed to generate audio. Falling back to default TTS.")"""

# Try line by line matching which is 100% immune to spacing differences and line endings!
target_lines = [line.strip() for line in target.splitlines() if line.strip()]
content_lines = content.splitlines()

found_idx = -1
for i in range(len(content_lines) - len(target_lines) + 1):
    match = True
    target_ptr = 0
    content_ptr = i
    while target_ptr < len(target_lines) and content_ptr < len(content_lines):
        if not content_lines[content_ptr].strip():
            content_ptr += 1
            continue
        if content_lines[content_ptr].strip() != target_lines[target_ptr]:
            match = False
            break
        target_ptr += 1
        content_ptr += 1
    if match and target_ptr == len(target_lines):
        found_idx = i
        found_end_idx = content_ptr
        break

if found_idx != -1:
    content_lines[found_idx:found_end_idx] = replacement.splitlines()
    with open(path, "w", encoding="utf-8") as f:
        f.write("\r\n".join(content_lines) if "\r\n" in content else "\n".join(content_lines))
    print("Successfully patched via advanced fuzzy line matching!")
else:
    # Try exact match as fallback
    if target in content:
        content = content.replace(target, replacement)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Successfully patched via exact match!")
    else:
        print("Target not found in server.py!")
