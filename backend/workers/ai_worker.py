"""
workers/ai_worker.py — Kafka consumer that processes all heavy AI jobs.

Run standalone alongside the FastAPI server:

    python -m workers.ai_worker

Or via Docker / systemd as a separate process.  Multiple replicas can run
safely — Kafka's consumer-group protocol ensures each message is handled by
exactly one replica.

Handled topics
--------------
eduai.document.analyze      → run_analysis_queued()
eduai.quiz.generate         → _bg_generate_quiz()
eduai.quiz.grade            → _bg_grade_quiz()
eduai.recap.generate        → _bg_generate_recap()
eduai.music.generate        → _bg_generate_music_for_students()
eduai.chat.respond          → _bg_respond_bot()
eduai.quiz.grade.student    → _bg_grade_student_session()
eduai.quiz.auto-publish     → _bg_auto_publish_quiz()
eduai.storage.upload        → _try_upload_supabase()

Poison messages (retried MAX_RETRIES times) are sent to eduai.dlq.
"""

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv  # noqa: E402

ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
env_path = os.path.join(ROOT_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)

from aiokafka.errors import KafkaConnectionError, NoBrokersAvailable  # noqa: E402

from core.kafka import make_consumer, ALL_TOPICS, KAFKA_BOOTSTRAP_SERVERS  # noqa: E402
from core.kafka import (  # noqa: E402
    TOPIC_DOCUMENT_ANALYZE,
    TOPIC_QUIZ_GENERATE,
    TOPIC_QUIZ_GRADE,
    TOPIC_RECAP_GENERATE,
    TOPIC_MUSIC_GENERATE,
    TOPIC_CHAT_RESPOND,
    TOPIC_QUIZ_GRADE_STUDENT,
    TOPIC_QUIZ_AUTO_PUBLISH,
    TOPIC_STORAGE_UPLOAD,
    MAX_RETRIES,
    _retry_count,
    publish_dlq,
    metrics,
)
from models.user import User  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("ai_worker")


# ── Message handlers ───────────────────────────────────────────────────────

def _user_from_dict(d: dict) -> User:
    """Reconstruct a User model from the serialised dict in the message."""
    return User(**d)


async def _handle_document_analyze(payload: dict) -> None:
    from services.ai_service import run_analysis_queued
    user = _user_from_dict(payload["user"])
    await run_analysis_queued(
        doc_id=payload["doc_id"],
        file_path=payload["file_path"],
        user=user,
        ip=payload.get("ip", "worker"),
    )


async def _handle_quiz_generate(payload: dict) -> None:
    from services.ai_service import _bg_generate_quiz
    user = _user_from_dict(payload["user"])
    await _bg_generate_quiz(
        quiz_id=payload["quiz_id"],
        documents=payload["documents"],
        user=user,
        n=payload["n"],
        ip=payload.get("ip", "worker"),
        recap_text=payload.get("recap_text", ""),
    )


async def _handle_quiz_grade(payload: dict) -> None:
    from services.ai_service import _bg_grade_quiz
    user = _user_from_dict(payload["user"])
    await _bg_grade_quiz(
        result_id=payload["result_id"],
        quiz=payload["quiz"],
        answers=payload["answers"],
        user=user,
        ip=payload.get("ip", "worker"),
    )


async def _handle_recap_generate(payload: dict) -> None:
    from services.ai_service import _bg_generate_recap
    user = _user_from_dict(payload["user"])
    await _bg_generate_recap(
        recap_id=payload["recap_id"],
        documents=payload["documents"],
        user=user,
        ip=payload.get("ip", "worker"),
    )


async def _handle_music_generate(payload: dict) -> None:
    from services.ai_service import _bg_generate_music_for_students
    await _bg_generate_music_for_students(
        doc_id=payload["doc_id"],
        target_class_rooms=payload["target_class_rooms"],
        institution_code=payload["institution_code"],
    )


async def _handle_chat_respond(payload: dict) -> None:
    from services.ai_service import _bg_respond_bot
    user = _user_from_dict(payload["user"])
    await _bg_respond_bot(
        doc_id=payload["doc_id"],
        question=payload["question"],
        doc=payload["doc"],
        audience=payload["audience"],
        owner_id=payload["owner_id"],
        user=user,
    )


async def _handle_quiz_grade_student(payload: dict) -> None:
    from routers.redeem import _bg_grade_student_session
    student_user = _user_from_dict(payload["student_user"])
    await _bg_grade_student_session(
        session_id=payload["session_id"],
        quiz=payload["quiz"],
        answers=payload["answers"],
        student_user=student_user,
        ip=payload.get("ip", "worker"),
    )


async def _handle_quiz_auto_publish(payload: dict) -> None:
    from routers.teacher_materials import _bg_auto_publish_quiz
    await _bg_auto_publish_quiz(
        quiz_id=payload["quiz_id"],
        target_classes=payload["target_classes"],
        deadline=payload.get("deadline"),
        published_by=payload["published_by"],
    )


async def _handle_storage_upload(payload: dict) -> None:
    from services.ai_service import _try_upload_supabase
    await _try_upload_supabase(
        user_id=payload["user_id"],
        doc_id=payload["doc_id"],
        file_path=payload["file_path"],
    )


HANDLERS = {
    TOPIC_DOCUMENT_ANALYZE: _handle_document_analyze,
    TOPIC_QUIZ_GENERATE: _handle_quiz_generate,
    TOPIC_QUIZ_GRADE: _handle_quiz_grade,
    TOPIC_RECAP_GENERATE: _handle_recap_generate,
    TOPIC_MUSIC_GENERATE: _handle_music_generate,
    TOPIC_CHAT_RESPOND: _handle_chat_respond,
    TOPIC_QUIZ_GRADE_STUDENT: _handle_quiz_grade_student,
    TOPIC_QUIZ_AUTO_PUBLISH: _handle_quiz_auto_publish,
    TOPIC_STORAGE_UPLOAD: _handle_storage_upload,
}

# Topics that should NOT be retried (already have internal retry logic)
NON_RETRYABLE_TOPICS = {
    TOPIC_QUIZ_AUTO_PUBLISH,
    TOPIC_STORAGE_UPLOAD,
}


# ── Main poll loop ─────────────────────────────────────────────────────────

RETRY_BACKOFF_SECONDS = 5
MAX_RETRY_SECONDS = 60


async def _run_consumer() -> None:
    backoff = RETRY_BACKOFF_SECONDS
    while True:
        consumer = make_consumer(ALL_TOPICS)
        try:
            await consumer.start()
            logger.info(
                f"Worker connected to Kafka ({KAFKA_BOOTSTRAP_SERVERS}), "
                f"listening on: {', '.join(ALL_TOPICS)}"
            )
            backoff = RETRY_BACKOFF_SECONDS

            async for msg in consumer:
                topic = msg.topic
                retries = _retry_count(msg.headers)
                try:
                    payload = msg.value
                    handler = HANDLERS.get(topic)

                    if handler is None:
                        logger.warning(f"No handler for topic '{topic}', skipping.")
                        await consumer.commit()
                        continue

                    logger.info(
                        f"Processing {topic} | "
                        f"partition={msg.partition} offset={msg.offset} "
                        f"retry={retries}/{MAX_RETRIES}"
                    )
                    metrics.messages_consumed += 1
                    await handler(payload)
                    logger.info(f"Done: {topic} offset={msg.offset}")

                except Exception as exc:
                    logger.exception(
                        f"Handler failed for {topic} offset={msg.offset}: {exc}"
                    )

                    # Send to DLQ if max retries exceeded (and topic supports retry)
                    if (
                        topic not in NON_RETRYABLE_TOPICS
                        and retries >= MAX_RETRIES
                    ):
                        logger.warning(
                            f"Max retries ({MAX_RETRIES}) exceeded for {topic}, "
                            f"sending to DLQ."
                        )
                        await publish_dlq(
                            original_topic=topic,
                            payload=msg.value,
                            error=str(exc)[:1000],
                            headers=msg.headers,
                        )
                    elif topic not in NON_RETRYABLE_TOPICS:
                        # Re-publish with incremented retry count
                        new_headers = list(msg.headers or [])
                        # Remove old retry_count if present
                        new_headers = [
                            (k, v) for k, v in new_headers
                            if k != "retry_count"
                        ]
                        new_headers.append(
                            ("retry_count", str(retries + 1).encode("utf-8"))
                        )

                        try:
                            from core.kafka import _producer
                            if _producer is not None:
                                await _producer.send_and_wait(
                                    topic,
                                    value=msg.value,
                                    key=msg.key,
                                    headers=new_headers,
                                )
                                logger.info(
                                    f"Re-queued {topic} offset={msg.offset} "
                                    f"retry={retries + 1}/{MAX_RETRIES}"
                                )
                        except Exception as repub_exc:
                            logger.error(
                                f"Failed to re-queue {topic}: {repub_exc}"
                            )

                finally:
                    await consumer.commit()

        except (KafkaConnectionError, NoBrokersAvailable) as exc:
            logger.warning(
                f"Kafka broker unreachable: {exc}. "
                f"Retrying in {backoff}s …"
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_RETRY_SECONDS)
        except asyncio.CancelledError:
            logger.info("Worker task cancelled, shutting down.")
            break
        except Exception as exc:
            logger.exception(
                f"Unexpected consumer error: {exc}. Restarting in {backoff}s …"
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_RETRY_SECONDS)
        finally:
            try:
                await consumer.stop()
            except Exception:
                pass


async def main() -> None:
    logger.info("EduAI Kafka worker starting …")
    await _run_consumer()


if __name__ == "__main__":
    asyncio.run(main())
