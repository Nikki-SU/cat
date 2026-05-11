"""缁撴瀯鎬ф枃鐚浉鍏?Schema"""
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
    anchor_id: Optional[str] = None  # 娈佃惤閿氱偣ID
    anchor_type: Optional[str] = "paragraph"  # paragraph | heading | block
    anchor_text: Optional[str] = None  # 閿氱偣鍘熸枃
    note_type: str = "markdown"  # markdown | image | code | mermaid | link
    content: Optional[str] = None
    metadata: Optional[dict] = None  # { imageUrl, codeLanguage, linkTarget, mermaidType }
    tags: Optional[List[str]] = None
    position_start: Optional[int] = None
    position_end: Optional[int] = None
    color: Optional[str] = None

class StructuredNoteCreate(StructuredNoteBase):
    pass

class StructuredNoteUpdate(BaseModel):
    anchor_id: Optional[str] = None
    anchor_type: Optional[str] = None
    anchor_text: Optional[str] = None
    note_type: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[dict] = None
    tags: Optional[List[str]] = None
    position_start: Optional[int] = None
    position_end: Optional[int] = None
    color: Optional[str] = None

class StructuredNoteResponse(StructuredNoteBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True
