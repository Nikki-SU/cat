"""结构性文献相关 Schema"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StructuredLiteratureBase(BaseModel):
    doi: str
    content: Optional[str] = None

class StructuredLiteratureCreate(StructuredLiteratureBase): pass

class StructuredLiteratureUpdate(BaseModel):
    content: Optional[str] = None

class StructuredLiteratureResponse(StructuredLiteratureBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class StructuredNoteBase(BaseModel):
    doi: Optional[str] = None
    note_type: str
    content: Optional[str] = None
    position: Optional[str] = None

class StructuredNoteCreate(StructuredNoteBase): pass

class StructuredNoteUpdate(BaseModel):
    doi: Optional[str] = None
    note_type: Optional[str] = None
    content: Optional[str] = None
    position: Optional[str] = None

class StructuredNoteResponse(StructuredNoteBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True
