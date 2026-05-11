"""组织相关 Schema"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class TagBase(BaseModel):
    name: str
    doi: Optional[str] = None

class TagCreate(TagBase): pass

class TagUpdate(BaseModel):
    name: Optional[str] = None
    doi: Optional[str] = None

class TagResponse(TagBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionCreate(CollectionBase): pass

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CollectionResponse(CollectionBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class CollectionItemBase(BaseModel):
    collection_id: int
    item_type: str
    item_id: int
    doi: Optional[str] = None

class CollectionItemCreate(CollectionItemBase): pass

class CollectionItemUpdate(BaseModel):
    collection_id: Optional[int] = None
    item_type: Optional[str] = None
    item_id: Optional[int] = None
    doi: Optional[str] = None

class CollectionItemResponse(CollectionItemBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class JournalGroupBase(BaseModel):
    name: str
    journals: Optional[List[str]] = None

class JournalGroupCreate(JournalGroupBase): pass

class JournalGroupUpdate(BaseModel):
    name: Optional[str] = None
    journals: Optional[List[str]] = None

class JournalGroupResponse(JournalGroupBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class KeywordGroupBase(BaseModel):
    name: str
    keywords: Optional[List[Dict[str, Any]]] = None

class KeywordGroupCreate(KeywordGroupBase): pass

class KeywordGroupUpdate(BaseModel):
    name: Optional[str] = None
    keywords: Optional[List[Dict[str, Any]]] = None

class KeywordGroupResponse(KeywordGroupBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
