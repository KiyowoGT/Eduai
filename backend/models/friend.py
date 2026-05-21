from pydantic import BaseModel

class FriendRequestPayload(BaseModel):
    target_user_id: str

class FriendRequestAction(BaseModel):
    request_id: str

class BlockUserPayload(BaseModel):
    target_user_id: str
