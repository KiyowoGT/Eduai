from pydantic import BaseModel

class FolderCreate(BaseModel):
    name: str

class FolderUpdate(BaseModel):
    name: str
