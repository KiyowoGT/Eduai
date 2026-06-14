"""
core/kafka.py — Kafka producer, consumer & monitoring for EduAI.

All heavy AI jobs are published as JSON messages to Kafka topics. A single
background worker (workers/ai_worker.py) consumes them so the FastAPI event
loop is never blocked.

Features
--------
- Dead-letter queue (DLQ) for poison messages
- Automatic retry headers (max 3 attempts before DLQ)
- Correlation ID for end-to-end tracing
- In-process health check & metrics
- Timeout-aware publish
- Graceful fallback when broker is unavailable
"""

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError, NoBrokersAvailable

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────
KAFKA_BOOTSTRAP_SERVERS: str = os.environ.get(
    "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
)
KAFKA_ENABLED: bool = os.environ.get("KAFKA_ENABLED", "true").lower() == "true"

# Maximum times a message will be retried before being sent to DLQ
MAX_RETRIES: int = int(os.environ.get("KAFKA_MAX_RETRIES", "3"))

# ── Topic names (existing) ─────────────────────────────────────────────────
TOPIC_DOCUMENT_ANALYZE = "eduai.document.analyze"
TOPIC_QUIZ_GENERATE = "eduai.quiz.generate"
TOPIC_QUIZ_GRADE = "eduai.quiz.grade"
TOPIC_RECAP_GENERATE = "eduai.recap.generate"

# ── Topic names (new) ──────────────────────────────────────────────────────
TOPIC_MUSIC_GENERATE = "eduai.music.generate"
TOPIC_CHAT_RESPOND = "eduai.chat.respond"
TOPIC_QUIZ_GRADE_STUDENT = "eduai.quiz.grade.student"
TOPIC_QUIZ_AUTO_PUBLISH = "eduai.quiz.auto-publish"
TOPIC_STORAGE_UPLOAD = "eduai.storage.upload"
TOPIC_CLEANUP = "eduai.tasks.cleanup"

# ── Dead-letter queue ──────────────────────────────────────────────────────
TOPIC_DLQ = "eduai.dlq"

ALL_TOPICS = [
    TOPIC_DOCUMENT_ANALYZE,
    TOPIC_QUIZ_GENERATE,
    TOPIC_QUIZ_GRADE,
    TOPIC_RECAP_GENERATE,
    TOPIC_MUSIC_GENERATE,
    TOPIC_CHAT_RESPOND,
    TOPIC_QUIZ_GRADE_STUDENT,
    TOPIC_QUIZ_AUTO_PUBLISH,
    TOPIC_STORAGE_UPLOAD,
    TOPIC_CLEANUP,
]

CONSUMER_GROUP = "eduai-workers-3"

# ── Module-level singletons ────────────────────────────────────────────────
_producer: Optional[AIOKafkaProducer] = None


# ── Metrics ────────────────────────────────────────────────────────────────
@dataclass
class KafkaMetrics:
    messages_published: int = 0
    messages_failed: int = 0
    messages_consumed: int = 0
    messages_dlq: int = 0
    producer_startups: int = 0
    producer_stops: int = 0
    last_error: Optional[str] = None
    _start_time: float = field(default_factory=time.time)

    @property
    def uptime_seconds(self) -> float:
        return time.time() - self._start_time

    def snapshot(self) -> dict:
        return {
            "messages_published": self.messages_published,
            "messages_failed": self.messages_failed,
            "messages_consumed": self.messages_consumed,
            "messages_dlq": self.messages_dlq,
            "producer_startups": self.producer_startups,
            "producer_stops": self.producer_stops,
            "uptime_seconds": self.uptime_seconds,
            "last_error": self.last_error,
            "producer_alive": _producer is not None,
            "kafka_enabled": KAFKA_ENABLED,
        }


metrics = KafkaMetrics()


# ── Serialisation helpers ──────────────────────────────────────────────────
def _encode(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")


def _decode(raw: bytes) -> dict:
    return json.loads(raw.decode("utf-8"))


def _correlation_id() -> str:
    """Generate a unique correlation ID for tracing a message end-to-end."""
    return uuid.uuid4().hex


def _retry_count(headers: list) -> int:
    """Extract the current retry count from message headers."""
    for key, val in (headers or []):
        if key == "retry_count":
            return int(val)
    return 0


# ── Producer lifecycle ─────────────────────────────────────────────────────
async def start_producer() -> None:
    """Start the global Kafka producer. Called from FastAPI startup."""
    global _producer
    if not KAFKA_ENABLED:
        logger.info("Kafka disabled (KAFKA_ENABLED=false); jobs will run inline.")
        return

    for attempt in range(3):
        try:
            _producer = AIOKafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=_encode,
                acks="all",
                linger_ms=20,
                compression_type="gzip",
                request_timeout_ms=30_000,
            )
            await _producer.start()
            metrics.producer_startups += 1
            logger.info(f"Kafka producer started → {KAFKA_BOOTSTRAP_SERVERS}")
            return
        except (KafkaConnectionError, NoBrokersAvailable) as exc:
            logger.warning(
                f"Kafka broker unreachable (attempt {attempt + 1}/3): {exc}"
            )
            _producer = None
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
        except Exception as exc:
            logger.warning(f"Kafka producer start failed: {exc}")
            _producer = None
            metrics.last_error = str(exc)
            return

    logger.warning(
        "Kafka producer could not be started after 3 attempts; "
        "jobs will run inline."
    )


async def stop_producer() -> None:
    """Flush & stop the global Kafka producer. Called from FastAPI shutdown."""
    global _producer
    if _producer is not None:
        try:
            await _producer.stop()
        except Exception as exc:
            logger.warning(f"Error stopping Kafka producer: {exc}")
        _producer = None
        metrics.producer_stops += 1
        logger.info("Kafka producer stopped.")


# ── Publish helper ─────────────────────────────────────────────────────────
async def publish(
    topic: str,
    payload: dict,
    key: Optional[str] = None,
    correlation_id: Optional[str] = None,
    headers: Optional[list] = None,
) -> bool:
    """
    Publish *payload* to *topic*. Returns True on success.

    If the producer is not available (Kafka disabled or broker down) this
    returns False so the caller can fall back to inline execution.

    Parameters
    ----------
    topic : str
        Kafka topic name.
    payload : dict
        JSON-serialisable message body.
    key : str, optional
        Partition key for ordering guarantees.
    correlation_id : str, optional
        Auto-generated if not provided.
    headers : list, optional
        Additional Kafka headers (list of (key, value) tuples, values as bytes).
    """
    if _producer is None:
        return False

    cid = correlation_id or _correlation_id()
    kafka_headers = [
        ("correlation_id", cid.encode("utf-8")),
        ("content_type", b"application/json"),
    ]
    if headers:
        kafka_headers.extend(
            (k, v.encode("utf-8") if isinstance(v, str) else v)
            for k, v in headers
        )

    try:
        await _producer.send_and_wait(
            topic,
            value=payload,
            key=key.encode("utf-8") if key else None,
            headers=kafka_headers,
        )
        metrics.messages_published += 1
        logger.debug(f"Published to {topic} | cid={cid}")
        return True
    except Exception as exc:
        metrics.messages_failed += 1
        metrics.last_error = str(exc)
        logger.error(f"Failed to publish to {topic}: {exc}")
        return False


# ── Dead-letter publish ────────────────────────────────────────────────────
async def publish_dlq(
    original_topic: str,
    payload: dict,
    error: str,
    headers: Optional[list] = None,
) -> bool:
    """
    Send a failed message to the dead-letter queue with error context.
    """
    dlq_payload = {
        "original_topic": original_topic,
        "error": error[:1000],
        "original_payload": payload,
        "dlq_timestamp": time.time(),
    }
    dlq_headers = [
        ("original_topic", original_topic.encode("utf-8")),
        ("error", error[:500].encode("utf-8")),
    ]
    if headers:
        dlq_headers.extend(
            (k, v.encode("utf-8") if isinstance(v, str) else v)
            for k, v in headers
        )
    ok = await publish(TOPIC_DLQ, dlq_payload, headers=dlq_headers)
    if ok:
        metrics.messages_dlq += 1
    return ok


# ── Health check ───────────────────────────────────────────────────────────
async def health_check() -> dict:
    """
    Returns a snapshot of Kafka producer health and metrics.
    Does NOT verify broker connectivity (passive check).
    """
    info = metrics.snapshot()
    if _producer is not None:
        try:
            info["broker_connected"] = True
        except Exception:
            info["broker_connected"] = False
    else:
        info["broker_connected"] = False
    return info


# ── Consumer factory ───────────────────────────────────────────────────────
def make_consumer(topics: list[str] = ALL_TOPICS) -> AIOKafkaConsumer:
    """
    Create (but do not start) a consumer subscribed to *topics*.
    """
    consumer = AIOKafkaConsumer(
        *topics,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id=CONSUMER_GROUP,
        value_deserializer=_decode,
        auto_offset_reset="earliest",
        enable_auto_commit=False,
        session_timeout_ms=45_000,
        heartbeat_interval_ms=5_000,
        max_poll_interval_ms=600_000,
    )
    return consumer
