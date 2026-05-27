"""笔记相关 Schema"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class GeneralNoteBase(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doi: Optional[str] = None
    file_type: Optional[str] = "markdown"
    file_data: Optional[Any] = None  # Excel: List[List], other: List[Dict]
    file_path: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    template_id: Optional[int] = None

class GeneralNoteCreate(GeneralNoteBase): pass

class GeneralNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    doi: Optional[str] = None
    file_type: Optional[str] = None
    file_data: Optional[Any] = None  # Excel: List[List], other: List[Dict]
    file_path: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    template_id: Optional[int] = None

class GeneralNoteResponse(GeneralNoteBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class NoteTemplateBase(BaseModel):
    name: str
    content: Optional[str] = None

class NoteTemplateCreate(NoteTemplateBase): pass

class NoteTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None

class NoteTemplateResponse(NoteTemplateBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
