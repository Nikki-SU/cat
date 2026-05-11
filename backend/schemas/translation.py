"""翻译相关 Schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TranslationCardBase(BaseModel):
    doi: Optional[str] = None
    original_text: str
    user_translation: Optional[str] = None
    ai_feedback: Optional[str] = None
    error_words: Optional[List[str]] = None

class TranslationCardCreate(TranslationCardBase): pass

class TranslationCardUpdate(BaseModel):
    doi: Optional[str] = None
    original_text: Optional[str] = None
    user_translation: Optional[str] = None
    ai_feedback: Optional[str] = None
    error_words: Optional[List[str]] = None

class TranslationCardResponse(TranslationCardBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
