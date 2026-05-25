import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
if (ROOT_DIR / '.env').exists():
    load_dotenv(ROOT_DIR / '.env', override=True)

UPLOAD_DIR = Path(os.environ.get('UPLOAD_DIR', str(ROOT_DIR / 'uploads')))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

AUDIO_DIR = ROOT_DIR / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'eduscanner_ai')

_raw_keys = os.environ.get('GEMINI_API_KEYS', '') or os.environ.get('GEMINI_API_KEY', '')
GEMINI_API_KEYS = [k.strip() for k in _raw_keys.split(',') if k.strip()]
GEMINI_API_KEY = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else ''
GEMINI_BASE_URL = os.environ.get('GEMINI_BASE_URL', "https://generativelanguage.googleapis.com/v1beta")
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', "gemini-2.5-flash")
GEMINI_ANALYSIS_MODEL = os.environ.get('GEMINI_ANALYSIS_MODEL', "gemini-2.5-flash")
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', "")
GROQ_MODEL = os.environ.get('GROQ_MODEL', "llama-3.3-70b-versatile")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

API_PREFIX = "" if os.environ.get("VERCEL") == "1" else "/api"

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))
BOT_RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("BOT_RATE_LIMIT_WINDOW_SECONDS", "60"))
BOT_RATE_LIMIT_MAX_MESSAGES = int(os.environ.get("BOT_RATE_LIMIT_MAX_MESSAGES", "5"))

# Initialize semaphore on demand or lazily to avoid loop binding issues
_hf_semaphore = None

def get_hf_semaphore():
    global _hf_semaphore
    if _hf_semaphore is None:
        _hf_semaphore = asyncio.Semaphore(1)
    return _hf_semaphore
