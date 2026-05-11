"""附件相关 Schema"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AttachmentBase(BaseModel):
    doi: Optional[str] = None
    filename: str
    file_type: str

class AttachmentCreate(AttachmentBase):
    file_size: Optional[int] = None

class AttachmentUpdate(BaseModel):
    doi: Optional[str] = None
    filename: Optional[str] = None
    file_type: Optional[str] = None

class AttachmentResponse(AttachmentBase):
    id: int
    file_size: Optional[int] = None
    file_path: Optional[str] = None
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
