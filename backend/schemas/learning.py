"""学习相关 Schema"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class WordBase(BaseModel):
    word_en: str
    word_cn: Optional[str] = None
    definition_en: Optional[str] = None
    definition_cn: Optional[str] = None
    sentence: Optional[str] = None
    doi: Optional[str] = None
    status: str = "new"
    review_count: int = 0
    correct_streak: int = 0

class WordCreate(WordBase): pass

class WordUpdate(BaseModel):
    word_en: Optional[str] = None
    word_cn: Optional[str] = None
    definition_en: Optional[str] = None
    definition_cn: Optional[str] = None
    sentence: Optional[str] = None
    doi: Optional[str] = None
    status: Optional[str] = None
    review_count: Optional[int] = None
    last_review: Optional[datetime] = None
    next_review: Optional[datetime] = None
    correct_streak: Optional[int] = None

class WordResponse(WordBase):
    id: int
    last_review: Optional[datetime] = None
    next_review: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class LongSentenceBase(BaseModel):
    sentence_en: str
    sentence_cn: Optional[str] = None
    doi: Optional[str] = None
    status: str = "new"
    review_count: int = 0
    correct_streak: int = 0

class LongSentenceCreate(LongSentenceBase): pass

class LongSentenceUpdate(BaseModel):
    sentence_en: Optional[str] = None
    sentence_cn: Optional[str] = None
    doi: Optional[str] = None
    status: Optional[str] = None
    review_count: Optional[int] = None
    last_review: Optional[datetime] = None
    next_review: Optional[datetime] = None
    correct_streak: Optional[int] = None

class LongSentenceResponse(LongSentenceBase):
    id: int
    last_review: Optional[datetime] = None
    next_review: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class WordListBase(BaseModel):
    name: str
    doi: Optional[str] = None
    word_ids: Optional[List[int]] = None

class WordListCreate(WordListBase): pass

class WordListUpdate(BaseModel):
    name: Optional[str] = None
    doi: Optional[str] = None
    word_ids: Optional[List[int]] = None

class WordListResponse(WordListBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class SentenceListBase(BaseModel):
    name: str
    doi: Optional[str] = None
    sentence_ids: Optional[List[int]] = None

class SentenceListCreate(SentenceListBase): pass

class SentenceListUpdate(BaseModel):
    name: Optional[str] = None
    doi: Optional[str] = None
    sentence_ids: Optional[List[int]] = None

class SentenceListResponse(SentenceListBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
