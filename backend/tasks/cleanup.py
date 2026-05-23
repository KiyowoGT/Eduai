import asyncio
import logging
from datetime import datetime, timezone, timedelta
from core.database import db

logger = logging.getLogger(__name__)

async def cleanup_anonymous_sessions_loop():
    logger.info("Cleanup task initialized for anonymous student sessions.")
    while True:
        try:
            ninety_days_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
            res = await db.student_sessions.delete_many({
                "student_user_id": None,  # Sesi anonim
                "started_at": {"$lt": ninety_days_ago}
            })
            if res.deleted_count > 0:
                logger.info(f"Cleanup task: Deleted {res.deleted_count} anonymous sessions older than 90 days.")
        except Exception as e:
            logger.error(f"Error in anonymous sessions cleanup loop: {e}")
        await asyncio.sleep(24 * 3600)  # Sleep selama 24 jam
