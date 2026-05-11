"""追踪相关 Schema"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TrackingRecordBase(BaseModel):
    date: Optional[str] = None
    journal: Optional[str] = None
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    doi: Optional[str] = None
    action: str = "added"


class TrackingRecordCreate(TrackingRecordBase): 
    """创建追踪记录"""
    pass


class TrackingRecordUpdate(BaseModel):
    """更新追踪记录"""
    date: Optional[str] = None
    journal: Optional[str] = None
    title_cn: Optional[str] = None
    title_en: Optional[str] = None
    doi: Optional[str] = None
    action: Optional[str] = None


class TrackingRecordResponse(TrackingRecordBase):
    