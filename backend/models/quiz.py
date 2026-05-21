from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    skill_type: str  # analisis_kode, troubleshooting, perancangan_db, konsep

class Quiz(BaseModel):
    quiz_id: str
    user_id: str
    document_id: str
    questions: List[QuizQuestion]
    created_at: datetime

    # Portal Guru additions
    visibility: Optional[str] = "private" # "private" or "institution"
    institution_code: Optional[str] = None
    status: Optional[str] = "ready" # "ready" or "published"
    published_at: Optional[datetime] = None
    published_by: Optional[str] = None
    subject_name: Optional[str] = None
    target_class_room: Optional[str] = None

class QuizGenerateRequest(BaseModel):
    document_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    folder_id: Optional[str] = None
    recap_id: Optional[str] = None
    question_count: int = 5

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: List[int]  # selected option indexes

class QuizProgressSave(BaseModel):
    answers: List[int]   # -1 for unanswered
    current_step: int

class FeedbackItem(BaseModel):
    question: str
    selected: str
    correct: str
    is_correct: bool
    explanation: str
    references: List[str]

class QuizChatPayload(BaseModel):
    question: str
