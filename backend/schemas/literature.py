"""文献相关 Schema"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LiteratureEntryBase(BaseModel):
    doi: str
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    journal: Optional[str] = None
    author: Optional[str] = None
    pubdate: Optional[str] = None
    abstract_cn: Optional[str] = None
    abstract_en: Optional[str] = None

class LiteratureEntryCreate(LiteratureEntryBase): pass

class LiteratureEntryUpdate(BaseModel):
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    journal: Optional[str] = None
    author: Optional[str] = None
    pubdate: Optional[str] = None
    abstract_cn: Optional[str] = None
    abstract_en: Optional[str] = None

class LiteratureEntryResponse(LiteratureEntryBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class LiteratureTableEntryBase(BaseModel):
    doi: str
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    journal: Optional[str] = None
    pubdate: Optional[str] = None
    first_author: Optional[str] = None
    communication_author: Optional[str] = None
    has_attachment: bool = False
    has_structured: bool = False
    has_card: bool = False
    has_notes: bool = False

class LiteratureTableEntryCreate(LiteratureTableEntryBase): pass

class LiteratureTableEntryUpdate(BaseModel):
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    journal: Optional[str] = None
    pubdate: Optional[str] = None
    first_author: Optional[str] = None
    communication_author: Optional[str] = None
    has_attachment: Optional[bool] = None
    has_structured: Optional[bool] = None
    has_card: Optional[bool] = None
    has_notes: Optional[bool] = None

class LiteratureTableEntryResponse(LiteratureTableEntryBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True
