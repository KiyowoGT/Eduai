"""
services/kafka_jobs.py — High-level publish helpers used by routers.

Each function serialises all the arguments a background handler needs,
publishes to the appropriate Kafka topic, and returns True if the job was
queued.  If Kafka is not available the caller falls back to
asyncio.create_task() so behaviour is unchanged in development.
"""

import logging
from typing import List, Optional

from models.user import User
from core.kafka import publish
from core.kafka import (
    TOPIC_DOCUMENT_ANALYZE,
    TOPIC_QUIZ_GENERATE,
    TOPIC_QUIZ_GRADE,
    TOPIC_RECAP_GENERATE,
    TOPIC_MUSIC_GENERATE,
    TOPIC_CHAT_RESPOND,
    TOPIC_QUIZ_GRADE_STUDENT,
    TOPIC_QUIZ_AUTO_PUBLISH,
    TOPIC_STORAGE_UPLOAD,
)

logger = logging.getLogger(__name__)


def _user_dict(user: User) -> dict:
    """Serialise only the fields needed to reconstruct a User in the worker."""
    return user.model_dump()


# ── Existing jobs ──────────────────────────────────────────────────────────


async def enqueue_document_analyze(
    doc_id: str,
    file_path: str,
    user: User,
    ip: str,
) -> bool:
    payload = {
        "doc_id": doc_id,
        "file_path": file_path,
        "user": _user_dict(user),
        "ip": ip,
    }
    queued = await publish(TOPIC_DOCUMENT_ANALYZE, payload)
    if queued:
        logger.info(f"[Kafka] Queued document analyse for doc_id={doc_id}")
    return queued


async def enqueue_quiz_generate(
    quiz_id: str,
    documents: List[dict],
    user: User,
    n: int,
    ip: str,
    recap_text: str = "",
) -> bool:
    payload = {
        "quiz_id": quiz_id,
        "documents": documents,
        "user": _user_dict(user),
        "n": n,
        "ip": ip,
        "recap_text": recap_text,
    }
    queued = await publish(TOPIC_QUIZ_GENERATE, payload)
    if queued:
        logger.info(f"[Kafka] Queued quiz generate for quiz_id={quiz_id}")
    return queued


async def enqueue_quiz_grade(
    result_id: str,
    quiz: dict,
    answers: List[int],
    user: User,
    ip: str,
) -> bool:
    payload = {
        "result_id": result_id,
        "quiz": quiz,
        "answers": answers,
        "user": _user_dict(user),
        "ip": ip,
    }
    queued = await publish(TOPIC_QUIZ_GRADE, payload)
    if queued:
        logger.info(f"[Kafka] Queued quiz grade for result_id={result_id}")
    return queued


async def enqueue_recap_generate(
    recap_id: str,
    documents: List[dict],
    user: User,
    ip: str,
) -> bool:
    payload = {
        "recap_id": recap_id,
        "documents": documents,
        "user": _user_dict(user),
        "ip": ip,
    }
    queued = await publish(TOPIC_RECAP_GENERATE, payload)
    if queued:
        logger.info(f"[Kafka] Queued recap generate for recap_id={recap_id}")
    return queued


# ── New jobs ───────────────────────────────────────────────────────────────


async def enqueue_music_generate(
    doc_id: str,
    target_class_rooms: list,
    institution_code: str,
) -> bool:
    payload = {
        "doc_id": doc_id,
        "target_class_rooms": target_class_rooms,
        "institution_code": institution_code,
    }
    queued = await publish(TOPIC_MUSIC_GENERATE, payload)
    if queued:
        logger.info(f"[Kafka] Queued music generate for doc_id={doc_id}")
    return queued


async def enqueue_chat_respond(
    doc_id: str,
    question: str,
    doc: dict,
    audience: str,
    owner_id: str,
    user: User,
) -> bool:
    payload = {
        "doc_id": doc_id,
        "question": question,
        "doc": doc,
        "audience": audience,
        "owner_id": owner_id,
        "user": _user_dict(user),
    }
    queued = await publish(TOPIC_CHAT_RESPOND, payload)
    if queued:
        logger.info(f"[Kafka] Queued chat respond for doc_id={doc_id}")
    return queued


async def enqueue_quiz_grade_student(
    session_id: str,
    quiz: dict,
    answers: List[int],
    student_user: User,
    ip: str,
) -> bool:
    payload = {
        "session_id": session_id,
        "quiz": quiz,
        "answers": answers,
        "student_user": _user_dict(student_user),
        "ip": ip,
    }
    queued = await publish(TOPIC_QUIZ_GRADE_STUDENT, payload)
    if queued:
        logger.info(f"[Kafka] Queued student quiz grade for session_id={session_id}")
    return queued


async def enqueue_quiz_auto_publish(
    quiz_id: str,
    target_classes: list,
    deadline: Optional[str],
    published_by: str,
) -> bool:
    payload = {
        "quiz_id": quiz_id,
        "target_classes": target_classes,
        "deadline": deadline,
        "published_by": published_by,
    }
    queued = await publish(TOPIC_QUIZ_AUTO_PUBLISH, payload)
    if queued:
        logger.info(f"[Kafka] Queued auto-publish for quiz_id={quiz_id}")
    return queued


async def enqueue_storage_upload(
    user_id: str,
    doc_id: str,
    file_path: str,
) -> bool:
    payload = {
        "user_id": user_id,
        "doc_id": doc_id,
        "file_path": file_path,
    }
    queued = await publish(TOPIC_STORAGE_UPLOAD, payload)
    if queued:
        logger.info(f"[Kafka] Queued storage upload for doc_id={doc_id}")
    return queued
