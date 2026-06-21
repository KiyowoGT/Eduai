import time
import logging
from core.config import BOT_RATE_LIMIT_MAX_MESSAGES, BOT_RATE_LIMIT_WINDOW_SECONDS

logger = logging.getLogger(__name__)

_BOT_RATE_LIMIT: dict[tuple[str, str], list[float]] = {}

def trim_block_times(times: list[float]) -> list[float]:
    cutoff = time.time() - BOT_RATE_LIMIT_WINDOW_SECONDS
    return [t for t in times if t >= cutoff]

def can_trigger_bot(doc_id: str, user_id: str) -> bool:
    key = (doc_id, user_id)
    times = trim_block_times(_BOT_RATE_LIMIT.get(key, []))
    if len(times) >= BOT_RATE_LIMIT_MAX_MESSAGES:
        _BOT_RATE_LIMIT[key] = times
        return False
    times.append(time.time())
    _BOT_RATE_LIMIT[key] = times
    return True
