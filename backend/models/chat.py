from typing import List
from pydantic import BaseModel

class ChatQuestion(BaseModel):
    question: str

class SendMessagePayload(BaseModel):
    content: str

class DiscussionInvitePayload(BaseModel):
    user_ids: List[str]

class DiscussionKickPayload(BaseModel):
    user_id: str

