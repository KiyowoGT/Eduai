import os
import re
import json
import logging
import uuid
import asyncio
import time
import random
import httpx
from datetime import datetime, timezone
from typing import List, Optional, Any, Set
from bson import Binary
from google import genai
from google.genai import types
from openai import OpenAI as GroqClient
from pypdf import PdfReader

from core.config import (
    GEMINI_API_KEYS,
    GEMINI_MODEL,
    GEMINI_ANALYSIS_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    get_hf_semaphore
)
from core.database import db
from core.websocket import realtime_hub
from models.user import User
from models.document import ConceptItem, DiagramItem, GeminiAnalysisResponse
from deps.auth import write_audit

logger = logging.getLogger(__name__)

# Semaphores and Limits
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))
BOT_RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("BOT_RATE_LIMIT_WINDOW_SECONDS", "60"))
BOT_RATE_LIMIT_MAX_MESSAGES = int(os.environ.get("BOT_RATE_LIMIT_MAX_MESSAGES", "5"))
_BOT_RATE_LIMIT: dict[tuple[str, str], list[float]] = {}

# Supabase Storage helper config
SUPABASE_STORAGE_URL = f"{SUPABASE_URL}/storage/v1" if SUPABASE_URL else ""

TEACHING_METHOD_PROMPTS = {
    "real_world": (
        "Pemanfaatan Lingkungan Sekitar: AI mengaitkan setiap konsep dengan fenomena sehari-hari, "
        "menggunakan analogi kehidupan nyata (seperti kecepatan bola, laju kereta, atau transaksi jual-beli). "
        "Tujuannya agar siswa melihat bahwa ilmu pengetahuan ada di sekeliling mereka."
    ),
    "imagination": (
        "Membangkitkan Imajinasi & Kreativitas: AI mendorong visualisasi konsep, memberikan pertanyaan terbuka, "
        "dan membuat skenario 'bagaimana jika' — fokus pada pemahaman logika dan metode, bukan sekadar menghafal rumus."
    ),
    "independence": (
        "Kemandirian dalam Keterbatasan: AI memberi tantangan yang memaksa siswa berpikir kreatif dan "
        "menemukan jawaban sendiri menggunakan sumber daya yang ada — menanamkan mentalitas problem-solver."
    ),
    "confidence": (
        "Peningkatan Kepercayaan Diri: AI mengapresiasi proses berpikir siswa, menggunakan bahasa yang membangun, "
        "dan memberikan tantangan di 'zona nyaman atas' untuk meningkatkan motivasi secara bertahap."
    ),
    "anand_kumar": (
        "Metode Pengajaran Anand Kumar: Mengubah cara AI mengajar dari sekadar memberi materi menjadi "
        "pengalaman belajar yang hidup dan bermakna. Gunakan pendekatan yang sangat motivasional, "
        "fokus pada pemecahan masalah yang menantang, dan buat siswa merasa mampu menaklukkan materi sesulit apa pun."
    ),
}

SANDBOX_PROMPT_TEMPLATE = """
Anda adalah AI Mentor EduAI untuk siswa {student_name} kelas {class_name}.

ATURAN KERAS:
1. Anda HANYA boleh menjawab pertanyaan berdasarkan dokumen berikut yang telah diverifikasi guru:
   {referenced_documents_summary}

2. Jika pertanyaan siswa di luar konteks dokumen di atas, jawab dengan sopan:
   "Maaf, saya hanya dapat membantu berdasarkan materi yang telah diajarkan di kelas. 
   Silakan tanyakan langsung ke guru untuk topik lainnya."

3. Jangan pernah melakukan browsing internet atau mengakses informasi eksternal.

4. Gunakan bahasa yang ramah, edukatif, dan sesuai tingkat kognitif siswa {grade_level}.

Pertanyaan siswa: {student_question}
"""

# ============== WebSocket Emitters ==============
async def _emit_document_status(user_id: str, document_id: str, status: str, **extra):
    payload = {"type": "document_status", "document_id": document_id, "status": status, **extra}
    await realtime_hub.broadcast(user_id, payload)


async def _emit_quiz_status(user_id: str, quiz_id: str, status: str, **extra):
    payload = {"type": "quiz_status", "quiz_id": quiz_id, "status": status, **extra}
    await realtime_hub.broadcast(user_id, payload)


async def _emit_result_status(user_id: str, result_id: str, status: str, **extra):
    payload = {"type": "quiz_result_status", "quiz_result_id": result_id, "status": status, **extra}
    await realtime_hub.broadcast(user_id, payload)


async def _emit_recap_status(user_id: str, recap_id: str, status: str, **extra):
    payload = {"type": "recap_status", "recap_id": recap_id, "status": status, **extra}
    await realtime_hub.broadcast(user_id, payload)


# ============== Bot Helper ==============
def _trim_block_times(times: list[float]) -> list[float]:
    cutoff = time.time() - BOT_RATE_LIMIT_WINDOW_SECONDS
    return [t for t in times if t >= cutoff]


def _can_trigger_bot(doc_id: str, user_id: str) -> bool:
    key = (doc_id, user_id)
    times = _trim_block_times(_BOT_RATE_LIMIT.get(key, []))
    if len(times) >= BOT_RATE_LIMIT_MAX_MESSAGES:
        _BOT_RATE_LIMIT[key] = times
        return False
    times.append(time.time())
    _BOT_RATE_LIMIT[key] = times
    return True


# ============== AI core setup ==============
async def _call_gemini(
    system_message: str,
    prompt: str,
    file_path: Optional[str] = None,
    model: Optional[str] = None,
    response_schema: Optional[type[Any]] = None,
) -> str:
    model_name = model or GEMINI_MODEL
    keys = list(GEMINI_API_KEYS) if GEMINI_API_KEYS else ['']

    last_error = None
    for key_idx, api_key in enumerate(keys):
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=300000,
                retry_options=types.HttpRetryOptions(
                    attempts=5,
                    initial_delay=1.0,
                    max_delay=30.0,
                    exp_base=2.0,
                    http_status_codes=[429, 503],
                ),
            ),
        )
        try:
            logger.info(f"Using Gemini key {key_idx + 1}/{len(keys)}")

            parts = [types.Part.from_text(text=prompt)]
            if file_path:
                def _read_file(path: str) -> bytes:
                    with open(path, "rb") as f:
                        return f.read()
                pdf_bytes = await asyncio.to_thread(_read_file, file_path)
                parts.insert(0, types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf",
                ))

            config_kwargs = dict(
                system_instruction=system_message,
                temperature=0.3 if response_schema else 0.7,
                max_output_tokens=8192,
            )
            if response_schema:
                config_kwargs["response_mime_type"] = "application/json"
                config_kwargs["response_schema"] = response_schema
            config = types.GenerateContentConfig(**config_kwargs)

            resp = await client.aio.models.generate_content(
                model=model_name,
                contents=[types.Content(role="user", parts=parts)],
                config=config,
            )
            if response_schema and hasattr(resp, 'parsed') and resp.parsed is not None:
                return json.dumps(resp.parsed.model_dump(), ensure_ascii=False)
            return resp.text
        except Exception as e:
            last_error = e
            err_msg = str(e)
            if any(x in err_msg for x in ["429", "RESOURCE_EXHAUSTED", "quota"]):
                if key_idx < len(keys) - 1:
                    logger.warning(f"Gemini key {key_idx + 1} quota exhausted, switching to next key...")
                    continue
            raise last_error

    raise last_error


async def _call_groq(system_message: str, prompt: str) -> str:
    total = len(system_message) + len(prompt)
    if total > 4000:
        max_prompt = max(500, 4000 - len(system_message))
        prompt = prompt[:max_prompt] + "\n... [jawaban dipotong, tetap jawab berdasarkan data yang ada]"
    def _gen() -> str:
        client = GroqClient(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=4096,
        )
        text = resp.choices[0].message.content
        text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()
        return text
    return await asyncio.to_thread(_gen)


def _audience(user: User) -> str:
    level = user.education_level or "Umum"
    major = user.major or ("Umum" if level in {"SD", "SMP"} else "Umum")
    sem = user.current_semester
    if level in {"SD", "SMP", "SMA", "SMK", "MA"}:
        sem_label = f"kelas {sem}" if sem else ""
        base = f"siswa {level} {sem_label} jurusan/peminatan {major}".strip()
    else:
        base = f"mahasiswa {level} semester {sem or '-'} prodi {major}"

    methods = user.teaching_methods or ["anand_kumar", "real_world", "imagination", "independence", "confidence"]
    method_instructions = []
    for m in methods:
        if m in TEACHING_METHOD_PROMPTS:
            method_instructions.append(TEACHING_METHOD_PROMPTS[m])
    
    if method_instructions:
        return (
            f"{base}\n\n"
            "VISI PENGAJARAN:\n"
            "Tujuanmu adalah membuat orang yang malas belajar menjadi mau, yang sudah mau menjadi rajin, "
            "dan yang sudah rajin menjadi semakin pintar.\n\n"
            "GAYA MENGAJAR & METODE:\n" + "\n".join(f"- {inst}" for inst in method_instructions)
        )
    return base


def _parse_json_block(text: str) -> Any:
    text = text.strip()
    text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = min((i for i in [text.find("{"), text.find("[")] if i != -1), default=-1)
        end = max(text.rfind("}"), text.rfind("]"))
        if start != -1 and end != -1 and end > start:
            candidate = text[start:end+1]
            if not candidate.startswith(("{", "[")):
                raise ValueError("Response AI tidak mengandung JSON yang valid")
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                cleaned = _clean_json(candidate)
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    raise ValueError("Gagal parse JSON dari response AI meski sudah dibersihkan")
        raise ValueError("Response AI tidak mengandung JSON")


def _clean_json(s: str) -> str:
    if not s or not s.strip():
        return s
    s = re.sub(r",\s*}", "}", s)
    s = re.sub(r",\s*\]", "]", s)
    s = s.replace("'", "\"")
    s = s.replace("True", "true").replace("False", "false").replace("None", "null")
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r'\\([^"\\/bfnrtu])', r'\\\1', s)
    return s.strip()


def _empty_analysis() -> dict:
    return {
        "title": "",
        "summary": "",
        "key_concepts": [],
        "diagrams": [],
        "learning_objectives": [],
    }


# ============== PDF Analysis & Extractors ==============
def _determine_chunk_size(total_pages: int) -> int:
    if total_pages <= 15:
        return 2
    if total_pages <= 30:
        return 3
    if total_pages <= 60:
        return 4
    return 5


def _extract_pages_text(reader: PdfReader, start_page: int, end_page: int) -> str:
    pages_text = []
    for i in range(start_page - 1, min(end_page, len(reader.pages))):
        page = reader.pages[i]
        text = page.extract_text() or ""
        pages_text.append(f"[PAGE {i+1}]\n{text}")
    return "\n\n".join(pages_text)


def _normalize_concept_name(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r'^(?:the|a|an)\s+', '', name)
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def _deduplicate_concepts(concepts: list) -> list:
    seen = {}
    for c in concepts:
        concept_name = c.get("concept", "")
        norm = _normalize_concept_name(concept_name)
        if not norm:
            continue
        current_len = len(c.get("explanation", "") + c.get("code_example", ""))
        if norm not in seen or current_len > len(seen[norm].get("explanation", "") + seen[norm].get("code_example", "")):
            seen[norm] = c
    return list(seen.values())


def _merge_diagrams(diagrams: list) -> list:
    merged = {}
    for d in diagrams:
        key = (_normalize_concept_name(d.get("name", "")), d.get("type", ""))
        current_len = len(d.get("explanation", ""))
        if key not in merged or current_len > len(merged[key].get("explanation", "")):
            merged[key] = d
    return list(merged.values())


async def _synthesize_summary_from_chunks(summaries: list, user: User) -> str:
    if len(summaries) <= 2:
        return "\n\n".join(s for s in summaries if s).strip()
    
    total_words = sum(len(s.split()) for s in summaries if s)
    if total_words < 300:
        return "\n\n".join(s for s in summaries if s).strip()
    
    audience = _audience(user)
    system = (
        f"Kamu adalah EduScanner AI untuk {audience}. "
        f"Gabungkan ringkasan-rumkasan berikut menjadi 3-4 paragraf padat (150-200 kata). "
        f"Jangan ulangi pengantar. Hasilkan ringkasan yang koheren dan fokus pada isi teknis."
    )
    prompt = "RINGKASAN-BATCH:\n\n" + "\n\n---\n\n".join(s for s in summaries if s)
    try:
        merged = await _call_groq(system, prompt)
        return merged.strip()
    except Exception as e:
        logger.warning(f"Summary merge failed: {e}, using concat fallback")
        return "\n\n".join(s for s in summaries if s).strip()


async def _analyze_batch(reader: PdfReader, start_page: int, end_page: int, user: User, total_batches: int, batch_idx: int) -> dict:
    text = _extract_pages_text(reader, start_page, end_page)
    if len(text) < 50:
        return {
            "summary": "",
            "key_concepts": [],
            "diagrams": [],
            "learning_objectives": [],
            "_batch_meta": {"start_page": start_page, "end_page": end_page, "concept_count": 0, "skipped": True, "error": None}
        }
    
    audience = _audience(user)
    system = (
        f"Kamu adalah EduScanner AI, asisten akademik elit untuk {audience}. "
        f"Tugasmu melakukan 'Deep Technical Extraction'. "
        f"Analisis HANYA halaman {start_page} sampai {end_page} dari dokumen ini. "
        f"Jangan berikan ringkasan umum. Bahasa Indonesia. Akademik, padat, fakta-oriented. "
        f"BATASAN KEAMANAN AKADEMIK: DILARANG KERAS memproses konten yang berkaitan dengan bimbingan konseling, inventaris, keuangan sekolah, atau psikologi personal. Jika terdeteksi, kosongkan semua field respon."
    )
    prompt = (
        "Ekstrak informasi dari halaman tertentu ini.\n"
        "Kewajiban:\n"
        "- Key concepts: 2-4 item (jika ada).\n"
        "- Diagrams: max 1 (jika ada).\n"
        "- Rangkuman: padat, teknis, menyertakan data/angka jika ada (maks 50 kata)."
    )
    
    data = None
    resp = None
    try:
        resp = await _call_gemini(system, prompt, model=GEMINI_ANALYSIS_MODEL, response_schema=GeminiAnalysisResponse)
        data = json.loads(resp)
    except Exception as e:
        logger.warning(f"Batch {batch_idx+1}/{total_batches} (halaman {start_page}-{end_page}) json.loads gagal: {e!r}")
        if resp:
            try:
                data = _parse_json_block(resp)
            except Exception:
                pass
    if data:
        return {
            "summary": data.get("summary", ""),
            "key_concepts": data.get("key_concepts", []),
            "diagrams": data.get("diagrams", []),
            "learning_objectives": data.get("learning_objectives", []),
            "_batch_meta": {
                "start_page": start_page,
                "end_page": end_page,
                "concept_count": len(data.get("key_concepts", [])),
                "skipped": False,
                "error": None
            }
        }
    return {
        "summary": "",
        "key_concepts": [],
        "diagrams": [],
        "learning_objectives": [],
        "_batch_meta": {"start_page": start_page, "end_page": end_page, "concept_count": 0, "skipped": True, "error": "json_parse_failed"}
    }


async def _analyze_pdf_legacy(file_path: str, user: User, total_pages: int = 0) -> dict:
    audience = _audience(user)
    system = (
        f"Kamu adalah EduScanner AI, asisten akademik elit untuk {audience}. "
        f"Tugasmu melakukan 'Deep Technical Extraction'. Jangan berikan rangkuman umum yang dangkal. "
        f"Gaya bahasa: Akademik, Padat, Fakta-Oriented. Bahasa Indonesia. "
        f"BATASAN KEAMANAN AKADEMIK: DILARANG KERAS memproses konten yang berkaitan dengan bimbingan konseling, inventaris, keuangan sekolah, atau psikologi personal. Jika terdeteksi, kosongkan semua field respon."
    )
    prompt = (
        "Analisis PDF ini dengan kedalaman tinggi.\n"
        "Kewajiban:\n"
        "- Jika ada angka, data statistik, atau terminologi sulit, WAJIB disertakan.\n"
        "- key_concepts minimal 7-10 poin agar sangat detail.\n"
        "- Hindari kalimat pembuka seperti 'Dokumen ini membahas tentang...'. Langsung ke substansi teknis.\n"
        "- summary: Rangkuman densitas tinggi (4-6 paragraf). Fokus pada: 1. Masalah utama, 2. Metodologi/Logika detail, 3. Temuan/Data spesifik, 4. Kesimpulan teknis."
    )
    use_flash3 = total_pages < 30
    if use_flash3:
        data = None
        try:
            resp3 = await _call_gemini(system, prompt, file_path=file_path, model=GEMINI_ANALYSIS_MODEL, response_schema=GeminiAnalysisResponse)
            data = json.loads(resp3)
        except Exception as e:
            logger.warning(f"Gemini-3-flash gagal ({e!r}), fallback ke gemini-2.5-flash")
            try:
                data = _parse_json_block(resp3)
            except Exception:
                data = None
        if data is not None:
            return data
    resp = None
    data = None
    try:
        resp = await _call_gemini(system, prompt, file_path=file_path, response_schema=GeminiAnalysisResponse)
        data = json.loads(resp)
    except Exception as e:
        logger.error(f"json.loads gagal: {e!r}")
        if resp:
            try:
                data = _parse_json_block(resp)
            except Exception as e2:
                logger.error(f"_parse_json_block juga gagal: {e2!r}")
    if data:
        return data
    return {"title": "", "summary": "", "key_concepts": [], "diagrams": [], "learning_objectives": []}


async def analyze_pdf(file_path: str, user: User) -> dict:
    await asyncio.sleep(2)
    
    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    
    if total_pages <= 200:
        return await _analyze_pdf_legacy(file_path, user, total_pages)
    
    chunk_size = _determine_chunk_size(total_pages) * 10
    overlap = 5
    step = chunk_size - overlap
    
    remaining = total_pages - chunk_size
    total_batches = (remaining + step - 1) // step + 1 if remaining > 0 else 1
    
    all_concepts = []
    all_diagrams = []
    all_objectives = []
    summaries = []
    
    for batch_idx in range(total_batches):
        if batch_idx > 0:
            await asyncio.sleep(5)
            
        start = 1 + batch_idx * step
        end = min(start + chunk_size - 1, total_pages)
        if start > total_pages:
            break
        
        batch = await _analyze_batch(reader, start, end, user, total_batches, batch_idx)
        
        if batch.get("summary"):
            summaries.append(batch.get("summary", ""))
        all_concepts.extend(batch.get("key_concepts", []))
        all_diagrams.extend(batch.get("diagrams", []))
        all_objectives.extend(batch.get("learning_objectives", []))
    
    unique_concepts = _deduplicate_concepts(all_concepts)[:25]
    merged_diagrams = _merge_diagrams(all_diagrams)[:12]
    
    seen_obj = set()
    unique_objectives = []
    for obj in all_objectives:
        norm = _normalize_concept_name(obj)
        if norm and norm not in seen_obj:
            seen_obj.add(norm)
            unique_objectives.append(obj)
            
    return {
        "title": f"Analisis Dokumen ({total_pages} hal)",
        "summary": await _synthesize_summary_from_chunks(summaries, user),
        "key_concepts": unique_concepts,
        "diagrams": merged_diagrams,
        "learning_objectives": unique_objectives[:12]
    }


async def _bg_analyze_document(doc_id: str, file_path: str, user: User, ip: str):
    try:
        analysis = await analyze_pdf(file_path, user)
        
        # Guard: Check for non-academic content that bypassed the pre-filter
        NON_ACADEMIC_KEYWORDS = [
            "bimbingan konseling",
            "inventaris",
            "keuangan sekolah",
            "psikologi personal"
        ]
        text_to_check = (analysis.get("summary", "") + " " + analysis.get("title", "")).lower()
        if any(kw in text_to_check for kw in NON_ACADEMIC_KEYWORDS):
            raise ValueError(
                "Konten dokumen tidak sesuai ruang lingkup akademik formal. "
                "Sistem menolak materi bertopik BK, inventaris, keuangan, atau psikologi personal."
            )

        current = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "status": 1})
        if not current or current.get("status") in ("cancelled", "deleted"):
            return
        update = {
            "title": analysis.get("title") or "",
            "summary": analysis.get("summary", ""),
            "key_concepts": analysis.get("key_concepts", []),
            "diagrams": analysis.get("diagrams", []),
            "learning_objectives": analysis.get("learning_objectives", []),
            "summary_ready_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.documents.update_one({"document_id": doc_id}, {"$set": update})
        await write_audit(user.user_id, "DOCUMENT_ANALYZED", {"document_id": doc_id}, ip)
    except Exception as e:
        logger.exception("Background analyze gagal")
        current = await db.documents.find_one({"document_id": doc_id}, {"_id": 0, "status": 1})
        if current and current.get("status") not in ("cancelled", "deleted"):
            err_msg = str(e)[:300]
            await db.documents.update_one(
                {"document_id": doc_id},
                {"$set": {"status": "failed", "error": err_msg}},
            )
            await write_audit(user.user_id, "DOCUMENT_ANALYSIS_FAILED", {"document_id": doc_id, "error": err_msg}, ip)
            await _emit_document_status(user.user_id, doc_id, "failed", error=err_msg)


async def run_analysis_queued(doc_id: str, file_path: str, user: User, ip: str):
    async with get_hf_semaphore():
        await _bg_analyze_document(doc_id, file_path, user, ip)

    current = await db.documents.find_one(
        {"document_id": doc_id},
        {
            "_id": 0,
            "status": 1,
            "summary": 1,
            "skip_hobby_personalization": 1,
        },
    )
    if not current or current.get("status") in ("cancelled", "deleted"):
        return

    hobby = (user.hobby or "").strip().lower()
    if not hobby or hobby == "none":
        await db.documents.update_one(
            {"document_id": doc_id},
            {
                "$set": {
                    "status": "ready",
                    "processing_stage": None,
                    "hobby_status": "idle",
                    "hobby_output_ready": False,
                }
            },
        )
        await _emit_document_status(user.user_id, doc_id, "ready", stage="completed")
        return

    await db.documents.update_one(
        {"document_id": doc_id},
        {
            "$set": {
                "status": "processing",
                "processing_stage": "hobby",
                "hobby_status": "processing",
                "hobby_output_ready": False,
            }
        },
    )
    await _emit_document_status(user.user_id, doc_id, "processing", stage="hobby")

    current = await db.documents.find_one(
        {"document_id": doc_id},
        {"_id": 0, "summary": 1, "status": 1, "skip_hobby_personalization": 1},
    )
    if not current or current.get("status") in ("cancelled", "deleted") or current.get("skip_hobby_personalization"):
        return

    if hobby == "musik":
        genre = (user.music_genre or "pop, romantic").strip()
        summary_text = current.get("summary", "")
        if summary_text:
            try:
                res = await aimusic(summary_text, genre)
                latest = await db.documents.find_one(
                    {"document_id": doc_id},
                    {"_id": 0, "status": 1, "skip_hobby_personalization": 1, "music_summaries": 1},
                )
                if not latest or latest.get("status") in ("cancelled", "deleted") or latest.get("skip_hobby_personalization"):
                    return
                music_summaries = latest.get("music_summaries", {})
                music_summaries[genre] = res
                await db.documents.update_one(
                    {"document_id": doc_id},
                    {
                        "$set": {
                            "music_summaries": music_summaries,
                            "hobby_status": "ready",
                            "hobby_output_ready": True,
                        }
                    }
                )
            except Exception as e:
                logger.warning(f"Gagal personalisasi musik untuk genre {genre}: {e}")
    else:
        try:
            doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0})
            if doc:
                pers = await personalize_document_for_student(doc, hobby)
                if pers:
                    latest = await db.documents.find_one(
                        {"document_id": doc_id},
                        {"_id": 0, "status": 1, "skip_hobby_personalization": 1},
                    )
                    if not latest or latest.get("status") in ("cancelled", "deleted") or latest.get("skip_hobby_personalization"):
                        return
                    await db.personalized_documents.insert_one({
                        "document_id": doc_id,
                        "user_id": user.user_id,
                        "hobby": hobby,
                        "summary": pers["summary"],
                        "key_concepts": pers["key_concepts"],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    await db.documents.update_one(
                        {"document_id": doc_id},
                        {
                            "$set": {
                                "hobby_status": "ready",
                                "hobby_output_ready": True,
                            }
                        },
                    )
        except Exception as e:
            logger.warning(f"Gagal personalisasi untuk hobi {hobby}: {e}")

    latest = await db.documents.find_one(
        {"document_id": doc_id},
        {"_id": 0, "status": 1, "skip_hobby_personalization": 1},
    )
    if not latest or latest.get("status") in ("cancelled", "deleted") or latest.get("skip_hobby_personalization"):
        return

    await db.documents.update_one(
        {"document_id": doc_id},
        {"$set": {"status": "ready", "processing_stage": None}},
    )
    await _emit_document_status(user.user_id, doc_id, "ready", stage="completed")


# ============== Quiz & Recap Generators ==============
async def generate_quiz_questions(documents: List[dict], user: User, n: int = 5, recap_text: str = "") -> List[dict]:
    batch_size = 10
    batches = []
    temp_n = n
    while temp_n > 0:
        batches.append(min(batch_size, temp_n))
        temp_n -= batch_size

    audience = _audience(user)

    async def _generate_batch(batch_count: int) -> List[dict]:
        if recap_text:
            context = recap_text[:5000]
            system = (
                f"Kamu adalah EduScanner AI, generator soal kuis HOTS bahasa Indonesia "
                f"untuk {audience}. Soal harus menguji analisis, evaluasi, dan kreativitas — bukan hafalan. "
                f"Sesuaikan tingkat kesulitan dengan jenjang. Buat soal berdasarkan rangkuman materi berikut."
            )
            prompt = (
                f"Berdasarkan rangkuman materi berikut, buat {batch_count} soal pilihan ganda HOTS. "
                f"Setiap soal punya 4 opsi (A-D), satu jawaban benar.\n\nRANGKUMAN:\n{context}\n\n"
                "Kembalikan JSON array saja, tanpa markdown:\n"
                '[{"question": "...", "options": ["...","...","...","..."], "correct_index": 0, "skill_type": "konsep", "source_title": ""}]'
            )
        else:
            multi = len(documents) > 1
            system = (
                f"Kamu adalah EduScanner AI, generator soal kuis HOTS bahasa Indonesia "
                f"untuk {audience}. Soal harus menguji analisis, evaluasi, dan kreativitas — bukan hafalan. "
                f"Sesuaikan tingkat kesulitan dengan jenjang."
                + (f" Soal harus mencakup keseluruhan {len(documents)} materi yang diberikan, distribusikan secara merata." if multi else "")
            )
            sources = []
            per_doc_budget = 1500 if len(documents) == 1 else (3000 // len(documents))
            for d in documents:
                sources.append({
                    "source": d.get("title") or d.get("filename") or "Dokumen",
                    "summary": (d.get("summary") or "")[:per_doc_budget],
                    "key_concepts": [c.get("concept", "") for c in d.get("key_concepts", [])[:3]], 
                    "learning_objectives": d.get("learning_objectives", [])[:2],
                })
            context = json.dumps(sources, ensure_ascii=False)
            if len(context) > 4000:
                context = context[:4000] + "..."
            prompt = (
                f"Berdasarkan materi berikut ({len(documents)} sumber), buat {batch_count} soal pilihan ganda HOTS. "
                f"Setiap soal punya 4 opsi (A-D), satu jawaban benar.\n\nMATERI:\n{context}\n\n"
                "Kembalikan JSON array saja, tanpa markdown. Tiap soal sertakan source_title (nama dokumen sumber):\n"
                '[{"question": "...", "options": ["...","...","...","..."], "correct_index": 0, "skill_type": "analisis_kode|troubleshooting|perancangan_db|konsep", "source_title": "judul dokumen"}]'
            )

        try:
            logger.info(f"Generating batch of {batch_count} quiz questions for {len(documents)} document(s)...")
            resp = await _call_groq(system, prompt)
            data = _parse_json_block(resp)
        except Exception as e:
            logger.warning(f"Quiz gen batch failed, retry: {e}")
            if recap_text:
                resp = await _call_groq(system, f"Buat {batch_count} soal HOTS dari rangkuman ini: {recap_text[:3000]}")
            else:
                minimal_sources = [{"source": s["source"], "summary": s["summary"][:500]} for s in sources]
                minimal_context = json.dumps(minimal_sources, ensure_ascii=False)
                resp = await _call_groq(system, f"Buat {batch_count} soal HOTS dari materi ini: {minimal_context}")
            data = _parse_json_block(resp)

        out = []
        for q in data[:batch_count]:
            out.append({
                "id": uuid.uuid4().hex[:8],
                "question": q["question"],
                "options": q["options"][:4],
                "correct_index": int(q["correct_index"]),
                "skill_type": q.get("skill_type", "konsep"),
                "source_title": q.get("source_title", ""),
            })
        return out

    tasks = [_generate_batch(b) for b in batches]
    results = await asyncio.gather(*tasks)
    
    all_questions = []
    for r in results:
        all_questions.extend(r)
    return all_questions[:n]


async def _bg_generate_quiz(quiz_id: str, documents: List[dict], user: User, n: int, ip: str, recap_text: str = ""):
    try:
        questions = await generate_quiz_questions(documents, user, n, recap_text=recap_text)
        current = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0, "status": 1})
        if not current or current.get("status") in ("cancelled", "deleted"):
            return
        target_status = "pending_approval" if user.institution_code else "ready"
        await db.quizzes.update_one(
            {"quiz_id": quiz_id},
            {"$set": {"questions": questions, "status": target_status}},
        )
        await write_audit(
            user.user_id,
            "QUIZ_GENERATED",
            {"quiz_id": quiz_id, "document_ids": [d.get("document_id") for d in documents]},
            ip,
        )
        await _emit_quiz_status(user.user_id, quiz_id, target_status)
    except Exception as e:
        logger.exception("Background quiz gen gagal")
        current = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0, "status": 1})
        if current and current.get("status") not in ("cancelled", "deleted"):
            await db.quizzes.update_one(
                {"quiz_id": quiz_id},
                {"$set": {"status": "failed", "error": str(e)[:300]}},
            )
            await _emit_quiz_status(user.user_id, quiz_id, "failed", error=str(e)[:300])


async def generate_recap(documents: List[dict], user: User) -> dict:
    audience = _audience(user)
    system = (
        f"Kamu EduScanner AI yang menggabungkan materi belajar untuk {audience}. "
        f"Bahasa Indonesia, jelas, sistematis. Output JSON saja tanpa markdown."
    )
    sources = []
    per_budget = 2500 if len(documents) == 1 else (4000 // len(documents))
    for d in documents:
        sources.append({
            "title": d.get("title") or d.get("filename") or "Dokumen",
            "summary": (d.get("summary") or "")[:per_budget],
            "key_concepts": [c.get("concept", "") for c in d.get("key_concepts", [])[:4]],
            "learning_objectives": d.get("learning_objectives", [])[:3],
        })
    context = json.dumps(sources, ensure_ascii=False)
    
    if len(context) > 4500:
        context = context[:4500] + "..."

    prompt = (
        f"Buat RANGKUMAN GABUNGAN dari {len(documents)} materi berikut:\n{context}\n\n"
        "Output JSON:\n"
        '{\n'
        '  "title": "judul rangkuman gabungan",\n'
        '  "unified_summary": "ringkasan terpadu 3-5 paragraf",\n'
        '  "per_document": [{"source_title":"...", "highlight":"poin penting"}],\n'
        '  "shared_concepts": [{"concept":"...","explanation":"..."}],\n'
        '  "study_path": ["langkah 1","..."]\n'
        '}'
    )
    
    try:
        resp = await _call_groq(system, prompt)
        return _parse_json_block(resp)
    except Exception:
        mini_context = json.dumps([{"t": s["title"]} for s in sources])
        try:
            resp = await _call_groq(system, f"Buat ringkasan sangat singkat dari daftar materi ini: {mini_context}")
            return {"title": "Ringkasan Minimal", "unified_summary": resp, "per_document": [], "shared_concepts": [], "study_path": []}
        except Exception:
            return {"title": "Ringkasan", "unified_summary": "", "per_document": [], "shared_concepts": [], "study_path": []}


async def _bg_generate_recap(recap_id: str, documents: List[dict], user: User, ip: str):
    try:
        data = await generate_recap(documents, user)
        current = await db.recaps.find_one({"recap_id": recap_id}, {"_id": 0, "status": 1, "folder_id": 1, "document_ids": 1})
        if not current or current.get("status") in ("cancelled", "deleted"):
            return

        folder_id = current.get("folder_id")
        if folder_id:
            await db.folders.update_one(
                {"folder_id": folder_id},
                {"$set": {
                    "recap_id": recap_id,
                    "recap_title": data.get("title", ""),
                    "recap_summary": data.get("unified_summary", ""),
                    "recap_document_ids": current.get("document_ids", []),
                    "recap_generated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )

        await db.recaps.update_one(
            {"recap_id": recap_id},
            {"$set": {
                "title": data.get("title", ""),
                "unified_summary": data.get("unified_summary", ""),
                "per_document": data.get("per_document", []),
                "shared_concepts": data.get("shared_concepts", []),
                "study_path": data.get("study_path", []),
                "status": "ready",
            }},
        )
        await write_audit(user.user_id, "RECAP_GENERATED", {"recap_id": recap_id, "count": len(documents)}, ip)
        await _emit_recap_status(user.user_id, recap_id, "ready")
    except Exception as e:
        logger.exception("Background recap gagal")
        current = await db.recaps.find_one({"recap_id": recap_id}, {"_id": 0, "status": 1})
        if current and current.get("status") not in ("cancelled", "deleted"):
            await db.recaps.update_one(
                {"recap_id": recap_id},
                {"$set": {"status": "failed", "error": str(e)[:300]}},
            )
            await _emit_recap_status(user.user_id, recap_id, "failed", error=str(e)[:300])


# ============== Quiz Grading & Feedback ==============
async def generate_deep_feedback(quiz: dict, answers: List[int], user: User) -> dict:
    audience = _audience(user)
    questions = quiz["questions"]
    total_q = len(questions)
    
    BATCH_SIZE = 5
    all_items = []
    total_score = 0
    summaries = []

    for i in range(0, total_q, BATCH_SIZE):
        batch_qs = questions[i:i + BATCH_SIZE]
        batch_ans = answers[i:i + BATCH_SIZE]
        
        items = []
        for j, q in enumerate(batch_qs):
            sel = batch_ans[j] if j < len(batch_ans) else -1
            items.append({
                "question": q["question"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "selected_index": sel,
            })

        system = (
            f"Kamu EduScanner AI memberi feedback akademik mendalam bahasa Indonesia untuk {audience}. "
            f"Batch {i//BATCH_SIZE + 1}. Selalu sertakan minimal satu referensi akademik atau buku pelajaran."
        )
        prompt = (
            "Berikan feedback per soal. Kembalikan JSON saja tanpa markdown.\n\n"
            f"SOAL+JAWABAN (Batch): {json.dumps(items, ensure_ascii=False)}\n\n"
            "Format:\n"
            '{\n'
            '  "score": 0-100 (untuk batch ini saja),\n'
            '  "summary": "ringkasan performa batch ini",\n'
            '  "items": [{"question":"...","selected":"...","correct":"...","is_correct":true,"explanation":"...","references":["...","..."]}]\n'
            '}'
        )
        
        if i > 0:
            await asyncio.sleep(2)
        try:
            resp = await _call_groq(system, prompt)
            batch_feedback = _parse_json_block(resp)
        except Exception:
            await asyncio.sleep(2)
            resp = await _call_groq(system, prompt)
            batch_feedback = _parse_json_block(resp)
            
        all_items.extend(batch_feedback.get("items", []))
        total_score += batch_feedback.get("score", 0) * (len(batch_qs) / total_q)
        summaries.append(batch_feedback.get("summary", ""))

    correct_count = sum(1 for it in all_items if it.get("is_correct"))
    actual_score = round((correct_count / total_q) * 100) if total_q > 0 else 0

    item_preview = []
    for it in all_items[:5]:
        label = "BENAR" if it.get("is_correct") else "SALAH"
        item_preview.append(f"[{label}] {it.get('question','')[:100]}")
    user_name = user.name.split()[0] if user.name else "Sahabat"
    sum_system = f"Kamu mentor akademik. Panggil user dengan nama '{user_name}' untuk pujian/validasi. Gunakan 'kamu' untuk instruksi/koreksi. Bahasa Indonesia santai. Max 3 kalimat."
    sum_prompt = (
        f"Nilai objektif: {actual_score}/100 ({correct_count}/{total_q} benar). "
        f"Buat 1 paragraf ringkasan performa. Jangan sebut nilai di luar {actual_score}.\n\n"
        + "\n".join(item_preview)
    )
    try:
        final_summary = await _call_gemini(sum_system, sum_prompt)
    except Exception:
        try:
            final_summary = await _call_groq(sum_system, sum_prompt)
        except Exception:
            final_summary = f"Skor {actual_score}/100 ({correct_count}/{total_q} benar)."

    return {
        "score": actual_score,
        "summary": final_summary,
        "items": all_items
    }


async def _bg_grade_quiz(result_id: str, quiz: dict, answers: List[int], user: User, ip: str):
    try:
        feedback = await generate_deep_feedback(quiz, answers, user)
        current = await db.quiz_results.find_one({"result_id": result_id}, {"_id": 0, "status": 1})
        if not current or current.get("status") in ("cancelled", "deleted"):
            return
        await db.quiz_results.update_one(
            {"result_id": result_id},
            {"$set": {
                "score": int(feedback.get("score", 0)),
                "summary": feedback.get("summary", ""),
                "items": feedback.get("items", []),
                "status": "ready",
            }},
        )
        await write_audit(user.user_id, "QUIZ_SUBMITTED", {"quiz_id": quiz["quiz_id"], "score": int(feedback.get("score", 0))}, ip)
        await _emit_result_status(user.user_id, result_id, "ready", score=int(feedback.get("score", 0)))
    except Exception as e:
        logger.exception("Background grading gagal")
        current = await db.quiz_results.find_one({"result_id": result_id}, {"_id": 0, "status": 1})
        if current and current.get("status") not in ("cancelled", "deleted"):
            await db.quiz_results.update_one(
                {"result_id": result_id},
                {"$set": {"status": "failed", "error": str(e)[:300]}},
            )
            await _emit_result_status(user.user_id, result_id, "failed", error=str(e)[:300])


# ============== Bot Discussion Worker ==============
def _build_doc_context(doc: dict) -> str:
    return json.dumps({
        "title": doc.get("title", ""),
        "summary": (doc.get("summary") or "")[:5000],
        "key_concepts": doc.get("key_concepts", [])[:10],
        "learning_objectives": doc.get("learning_objectives", [])[:8],
    }, ensure_ascii=False)


async def _bg_respond_bot(doc_id: str, question: str, doc: dict, audience: str, owner_id: str, user: User = None):
    context = _build_doc_context(doc)
    
    if user and user.role == "pelajar" and user.institution_code:
        # Sandbox mode
        system = "Anda adalah AI Mentor EduAI yang disiplin."
        prompt = SANDBOX_PROMPT_TEMPLATE.format(
            student_name=user.name,
            class_name=user.enrolled_class or "Umum",
            referenced_documents_summary=context,
            grade_level=user.education_level or "Sekolah",
            student_question=question
        )
    else:
        system = (
            f"Kamu adalah EduBot, asisten belajar untuk {audience}. "
            f"Jawab pertanyaan berdasarkan konten dokumen. Bahasa Indonesia. "
            f"Jika di luar konteks, beri tahu dengan sopan."
        )
        prompt = (
            f"KONTEN DOKUMEN:\n{context}\n\n"
            f"PERTANYAAN: {question}\n\n"
            f"Jawab dengan jelas. Berikan contoh bila memungkinkan."
        )
    
    try:
        resp = await _call_groq(system, prompt)
        bot_msg = {
            "message_id": uuid.uuid4().hex,
            "document_id": doc_id,
            "user_id": "bot",
            "user_name": "EduBot",
            "user_picture": None,
            "content": resp,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.discussion_messages.insert_one(bot_msg)
        participant_ids = {owner_id}
        async for p in db.discussion_participants.find({"document_id": doc_id}, {"_id": 0, "user_id": 1}):
            participant_ids.add(p["user_id"])
        for pid in participant_ids:
            if pid and pid != "bot":
                await realtime_hub.broadcast(pid, {"type": "discussion_message", "document_id": doc_id, "message": bot_msg})
    except Exception as e:
        logger.warning(f"Bot respond gagal: {e}")


# ============== Supabase Storage Helpers ==============
async def _ensure_pdfs_bucket():
    if not SUPABASE_STORAGE_URL or not SUPABASE_URL:
        logger.warning("Supabase not configured, skipping bucket creation")
        return
    try:
        async with httpx.AsyncClient() as hc:
            r = await hc.post(
                f"{SUPABASE_STORAGE_URL}/bucket",
                headers={
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "Content-Type": "application/json",
                },
                json={"id": "pdf", "name": "pdf", "public": True},
            )
            if r.status_code in (200, 201):
                logger.info("Supabase bucket 'pdf' created")
            elif r.status_code == 409:
                logger.info("Supabase bucket 'pdf' already exists")
            else:
                logger.warning(f"Supabase bucket creation: {r.status_code} {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Could not create Supabase bucket (may already exist): {e}")


async def _upload_to_supabase_storage(user_id: str, document_id: str, file_path: str) -> Optional[str]:
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


async def _delete_from_supabase_storage(user_id: str, document_id: str):
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


async def _try_upload_supabase(user_id: str, doc_id: str, file_path: str):
    try:
        url = await _upload_to_supabase_storage(user_id, doc_id, file_path)
        if url:
            await db.documents.update_one(
                {"document_id": doc_id},
                {"$set": {"pdf_url": url}},
            )
    except Exception as e:
        logger.warning(f"Supabase background upload skipped: {e}")


async def aimusic(prompt: str, tags: str = "pop, romantic") -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        query_payload = [
            {
                "role": "system",
                "content": "You are a professional lyricist AI trained to write poetic and rhythmic song lyrics. Respond with lyrics only, using [verse], [chorus], [bridge], and [instrumental] or [inst] tags to structure the song. Use only the tag (e.g., [verse]) without any numbering or extra text (e.g., do not write [verse 1], [chorus x2], etc). Do not add explanations, titles, or any other text outside of the lyrics. Focus on vivid imagery, emotional flow, and strong lyrical rhythm. Refrain from labeling genre or giving commentary. Respond in clean plain text, exactly as if it were a song lyric sheet."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]

        r1 = await client.get(
            "https://8pe3nv3qha.execute-api.us-east-1.amazonaws.com/default/llm_chat",
            params={
                "query": json.dumps(query_payload),
                "link": "writecream.com"
            }
        )
        if r1.status_code != 200:
            raise Exception(f"Gagal membuat lirik dari API: {r1.status_code}")

        ai_res = r1.json()
        lyrics = ai_res.get("response_content", "")
        if not lyrics:
            raise Exception("Respons lirik kosong dari AI")

        session_hash = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=10))

        r2 = await client.post(
            "https://ace-step-ace-step.hf.space/gradio_api/queue/join?",
            json={
                "data": [
                    240,
                    tags,
                    lyrics,
                    60,
                    15,
                    'euler',
                    'apg',
                    10,
                    '',
                    0.5,
                    0,
                    3,
                    True,
                    False,
                    True,
                    '',
                    0,
                    0,
                    False,
                    0.5,
                    None,
                    'none'
                ],
                "event_data": None,
                "fn_index": 11,
                "trigger_id": 45,
                "session_hash": session_hash
            }
        )
        if r2.status_code != 200:
            raise Exception(f"Gagal mengirim aransemen ke HF: {r2.status_code}")

        audio_url = None
        for _ in range(45):
            await asyncio.sleep(2.0)
            r3 = await client.get(
                f"https://ace-step-ace-step.hf.space/gradio_api/queue/data?session_hash={session_hash}"
            )
            if r3.status_code != 200:
                continue

            lines = r3.text.split("\n\n")
            for line in lines:
                if line.startswith("data:"):
                    try:
                        d = json.loads(line[5:])
                        if d.get("msg") == "process_completed":
                            audio_url = d["output"]["data"][0]["url"]
                            break
                    except Exception:
                        pass
            if audio_url:
                break

        if not audio_url:
            raise Exception("Pembuatan audio musik timeout di HF Space")

        return {
            "lyrics": lyrics,
            "audio_url": audio_url
        }


async def aimusic_suno(prompt: str, style: str = "pop, romantic", title: str = "", instrumental: bool = False) -> dict:
    """Generate music using Suno via nekorinn API."""
    import hashlib

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Step 1: Get Cloudflare Turnstile token
        cf_r = await client.get(
            "https://api.nekorinn.my.id/tools/rynn-stuff",
            params={
                "mode": "turnstile-min",
                "siteKey": "0x4AAAAAAAgeJUEUvYlF2CzO",
                "url": "https://songgenerator.io/features/s-45",
                "accessKey": "2c9247ce8044d5f87af608a244e10c94c5563b665e5f32a4bb2b2ad17613c1fc"
            }
        )
        if cf_r.status_code != 200:
            raise Exception(f"Gagal mendapatkan CF token: {cf_r.status_code}")
        cf_token = cf_r.json()["result"]["token"]

        uid = hashlib.md5(str(time.time()).encode()).hexdigest()

        # Step 2: Create task
        task_r = await client.post(
            "https://aiarticle.erweima.ai/api/v1/secondary-page/api/create",
            json={
                "prompt": prompt,
                "channel": "MUSIC",
                "id": 1631,
                "type": "features",
                "source": "songgenerator.io",
                "style": style,
                "title": title,
                "customMode": False,
                "instrumental": instrumental
            },
            headers={"uniqueid": uid, "verify": cf_token}
        )
        if task_r.status_code != 200:
            raise Exception(f"Gagal membuat task Suno: {task_r.status_code}")
        record_id = task_r.json()["data"]["recordId"]

        # Step 3: Poll for result
        for _ in range(120):
            await asyncio.sleep(2.0)
            poll_r = await client.get(
                f"https://aiarticle.erweima.ai/api/v1/secondary-page/api/{record_id}",
                headers={"uniqueid": uid, "verify": cf_token}
            )
            if poll_r.status_code != 200:
                continue
            data = poll_r.json().get("data", {})
            if data.get("state") == "success":
                result = json.loads(data["completeData"])
                songs = result if isinstance(result, list) else [result]
                return {
                    "lyrics": songs[0].get("lyric", ""),
                    "audio_url": songs[0].get("audioUrl", ""),
                    "songs": songs
                }

        raise Exception("Suno music generation timeout")


async def _bg_generate_music_for_students(doc_id: str, target_class_rooms: list, institution_code: str):
    try:
        doc = await db.documents.find_one({"document_id": doc_id}, {"_id": 0})
        if not doc or not doc.get("summary"):
            return

        cursor = db.users.find({
            "institution_code": institution_code,
            "enrolled_class": {"$in": target_class_rooms},
            "role": "pelajar",
            "hobby": "musik"
        })

        genres_needed = set()
        async for student in cursor:
            genre = (student.get("music_genre") or "pop, romantic").strip()
            genres_needed.add(genre)

        if not genres_needed:
            return

        existing = doc.get("music_summaries", {})
        to_generate = genres_needed - set(existing.keys())

        if not to_generate:
            return

        for genre in to_generate:
            try:
                res = await aimusic(doc["summary"], genre)
                existing[genre] = res
            except Exception as e:
                logger.warning(f"Music generation gagal utk genre {genre} doc {doc_id}: {e}")

        await db.documents.update_one(
            {"document_id": doc_id},
            {"$set": {"music_summaries": existing}}
        )
    except Exception as e:
        logger.warning(f"Background music generation for students gagal: {e}")


async def personalize_document_for_student(doc: dict, hobby: str) -> dict:
    original_summary = doc.get("summary", "")
    original_concepts = doc.get("key_concepts", [])
    
    system_message = (
        f"Kamu adalah AI Mentor EduAI. Tugasmu adalah mengadaptasi materi pembelajaran (ringkasan dan konsep kunci) "
        f"agar disesuaikan dengan hobi/minat siswa: {hobby}.\n"
        f"Gunakan bahasa Indonesia yang santai, edukatif, dan menarik bagi siswa.\n"
        f"Kembalikan data dalam format JSON dengan kunci:\n"
        f"- summary (string: ringkasan materi yang dihubungkan dengan hobi/minat tersebut melalui analogi atau contoh)\n"
        f"- key_concepts (array of objects: konsep kunci yang diadaptasikan penjelasannya dengan hobi tersebut, tiap objek memiliki kunci 'concept' dan 'explanation')"
    )
    
    prompt = (
        f"Berikut adalah materi asli:\n"
        f"Ringkasan:\n{original_summary}\n\n"
        f"Konsep Kunci:\n{json.dumps(original_concepts, ensure_ascii=False)}\n\n"
        f"Tolong ubah materi di atas agar dihubungkan secara kreatif dengan hobi/minat '{hobby}'."
    )
    
    try:
        resp = await _call_groq(system_message, prompt)
        import re
        match = re.search(r'\{.*\}', resp, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {
                "summary": data.get("summary", original_summary),
                "key_concepts": data.get("key_concepts", original_concepts)
            }
    except Exception as e:
        logger.warning(f"Gagal melakukan personalisasi materi untuk hobi {hobby}: {e}")
    
    return {
        "summary": original_summary,
        "key_concepts": original_concepts
    }
