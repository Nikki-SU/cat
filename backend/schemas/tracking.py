"""追踪相关 Schema"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TrackingRecordBase(BaseModel):
    date: Optional[str] = None
    journal: Optional[str] = None
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    doi: Optional[str] = None
    action: str = "added"

class TrackingRecordCreate(TrackingRecordBase): pass

class TrackingRecordUpdate(BaseModel):
    date: Optional[str] = None
    journal: Optional[str] = None
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    doi: Optional[str] = None
    action: Optional[str] = None

class TrackingRecordResponse(TrackingRecordBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True
