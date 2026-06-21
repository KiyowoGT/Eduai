import logging
from typing import List, Optional

from models.user import User
from core.kafka import (
    publish,
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

_TOPIC_LABELS = {
    TOPIC_DOCUMENT_ANALYZE: "document analyse",
    TOPIC_QUIZ_GENERATE: "quiz generate",
    TOPIC_QUIZ_GRADE: "quiz grade",
    TOPIC_RECAP_GENERATE: "recap generate",
    TOPIC_MUSIC_GENERATE: "music generate",
    TOPIC_CHAT_RESPOND: "chat respond",
    TOPIC_QUIZ_GRADE_STUDENT: "student quiz grade",
    TOPIC_QUIZ_AUTO_PUBLISH: "auto-publish",
    TOPIC_STORAGE_UPLOAD: "storage upload",
}

_ID_FIELDS = {
    TOPIC_DOCUMENT_ANALYZE: "doc_id",
    TOPIC_QUIZ_GENERATE: "quiz_id",
    TOPIC_QUIZ_GRADE: "result_id",
    TOPIC_RECAP_GENERATE: "recap_id",
    TOPIC_MUSIC_GENERATE: "doc_id",
    TOPIC_CHAT_RESPOND: "doc_id",
    TOPIC_QUIZ_GRADE_STUDENT: "session_id",
    TOPIC_QUIZ_AUTO_PUBLISH: "quiz_id",
    TOPIC_STORAGE_UPLOAD: "doc_id",
}


def _user_dict(user: User) -> dict:
    return user.model_dump()


async def _enqueue(topic: str, payload: dict) -> bool:
    queued = await publish(topic, payload)
    if queued:
        id_field = _ID_FIELDS[topic]
        label = _TOPIC_LABELS[topic]
        logger.info(f"[Kafka] Queued {label} for {id_field}={payload.get(id_field)}")
    return queued


async def enqueue_document_analyze(doc_id: str, file_path: str, user: User, ip: str) -> bool:
    return await _enqueue(TOPIC_DOCUMENT_ANALYZE, {
        "doc_id": doc_id, "file_path": file_path, "user": _user_dict(user), "ip": ip,
    })


async def enqueue_quiz_generate(quiz_id: str, documents: List[dict], user: User, n: int, ip: str, recap_text: str = "") -> bool:
    return await _enqueue(TOPIC_QUIZ_GENERATE, {
        "quiz_id": quiz_id, "documents": documents, "user": _user_dict(user), "n": n, "ip": ip, "recap_text": recap_text,
    })


async def enqueue_quiz_grade(result_id: str, quiz: dict, answers: List[int], user: User, ip: str) -> bool:
    return await _enqueue(TOPIC_QUIZ_GRADE, {
        "result_id": result_id, "quiz": quiz, "answers": answers, "user": _user_dict(user), "ip": ip,
    })


async def enqueue_recap_generate(recap_id: str, documents: List[dict], user: User, ip: str) -> bool:
    return await _enqueue(TOPIC_RECAP_GENERATE, {
        "recap_id": recap_id, "documents": documents, "user": _user_dict(user), "ip": ip,
    })


async def enqueue_music_generate(doc_id: str, target_class_rooms: list, institution_code: str) -> bool:
    return await _enqueue(TOPIC_MUSIC_GENERATE, {
        "doc_id": doc_id, "target_class_rooms": target_class_rooms, "institution_code": institution_code,
    })


async def enqueue_chat_respond(doc_id: str, question: str, doc: dict, audience: str, owner_id: str, user: User) -> bool:
    return await _enqueue(TOPIC_CHAT_RESPOND, {
        "doc_id": doc_id, "question": question, "doc": doc, "audience": audience, "owner_id": owner_id, "user": _user_dict(user),
    })


async def enqueue_quiz_grade_student(session_id: str, quiz: dict, answers: List[int], student_user: User, ip: str) -> bool:
    return await _enqueue(TOPIC_QUIZ_GRADE_STUDENT, {
        "session_id": session_id, "quiz": quiz, "answers": answers, "student_user": _user_dict(student_user), "ip": ip,
    })


async def enqueue_quiz_auto_publish(quiz_id: str, target_classes: list, deadline: Optional[str], published_by: str) -> bool:
    return await _enqueue(TOPIC_QUIZ_AUTO_PUBLISH, {
        "quiz_id": quiz_id, "target_classes": target_classes, "deadline": deadline, "published_by": published_by,
    })


async def enqueue_storage_upload(user_id: str, doc_id: str, file_path: str) -> bool:
    return await _enqueue(TOPIC_STORAGE_UPLOAD, {
        "user_id": user_id, "doc_id": doc_id, "file_path": file_path,
    })
