"""文献卡片相关 Schema"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class LiteratureCardBase(BaseModel):
    doi: str
    title_cn: str
    title_en: str
    journal: str
    author: str
    pubdate: str
    abstract_cn: str
    abstract_en: str
    keyword_cn: str
    keyword_en: str
    cover_image: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = None
    template_id: Optional[int] = None

class LiteratureCardCreate(LiteratureCardBase): pass

class LiteratureCardUpdate(BaseModel):
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    journal: Optional[str] = None
    author: Optional[str] = None
    pubdate: Optional[str] = None
    abstract_cn: Optional[str] = None
    abstract_en: Optional[str] = None
    keyword_cn: Optional[str] = None
    keyword_en: Optional[str] = None
    cover_image: Optional[str] = None
    extra_fields: Optional[Dict[str, Any]] = None
    template_id: Optional[int] = None

class LiteratureCardResponse(LiteratureCardBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class CardPromptTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False

class CardPromptTemplateCreate(CardPromptTemplateBase): pass

class CardPromptTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None

class CardPromptTemplateResponse(CardPromptTemplateBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class CardTemplateBase(BaseModel):
    prompt_template_id: Optional[int] = None
    name: str
    prompt: Optional[str] = None
    is_default: bool = False

class CardTemplateCreate(CardTemplateBase): pass

class CardTemplateUpdate(BaseModel):
    prompt_template_id: Optional[int] = None
    name: Optional[str] = None
    prompt: Optional[str] = None
    is_default: Optional[bool] = None

class CardTemplateResponse(CardTemplateBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
