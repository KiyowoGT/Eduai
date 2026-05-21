from typing import List, Optional
from pydantic import BaseModel

class RecapRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    folder_id: Optional[str] = None
