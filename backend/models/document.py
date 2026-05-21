from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class MaterialGeneratePayload(BaseModel):
    subject_id: str
    subject_name: str
    topic: Optional[str] = None

class ConceptItem(BaseModel):
    concept: str
    explanation: str
    code_example: Optional[str] = None

class DiagramItem(BaseModel):
    name: str
    type: str
    explanation: str

class DocumentMeta(BaseModel):
    document_id: str
    user_id: str
    filename: str
    title: Optional[str] = None
    summary: Optional[str] = None
    key_concepts: List[Dict[str, Any]] = []
    diagrams: List[Dict[str, Any]] = []
    learning_objectives: List[str] = []
    status: str = "processing"
    created_at: datetime
    
    # Portal Guru additions
    visibility: Optional[str] = "private" # "private" or "institution"
    institution_code: Optional[str] = None
    published_at: Optional[datetime] = None
    published_by: Optional[str] = None
    subject_name: Optional[str] = None
    target_class_room: Optional[str] = None

class DocumentMove(BaseModel):
    document_ids: List[str]
    folder_id: Optional[str] = None

class GeminiAnalysisResponse(BaseModel):
    title: str
    summary: str
    key_concepts: List[ConceptItem]
    diagrams: List[DiagramItem]
    learning_objectives: List[str]
