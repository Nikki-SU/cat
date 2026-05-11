"""追踪相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from datetime import datetime
from io import StringIO, BytesIO
import csv

from database import get_db
from models.tracking import TrackingRecord
from models.literature import LiteratureTableEntry, LiteratureEntry
from schemas.tracking import TrackingRecordCreate, TrackingRecordUpdate, TrackingRecordResponse
from services.crossref_service import get_crossref_service, CrossRefService
from services.ai_service import get_ai_service

router = APIRouter(prefix="/tracking", tags=["追踪"])


def get_crossref() -> CrossRefService:
    return get_crossref_service()


def get_ai() -> AIService:
    return get_ai_service()


# ==================== 追踪记录 CRUD ====================

@router.get("/records", response_model=List[TrackingRecordResponse])
def list_tracking_records(
    skip: int = 0, limit: int = 100,
    journal: Optional[str] = None, action: Optional[str] = None,
    sort_by: str = "created_at", sort_order: str = "desc",
    db: Session = Depends(get_db)
):
    """获取追踪记录列表"""
    query = db.query(TrackingRecord)
    if journal:
        query = query.filter(TrackingRecord.journal == journal)
    if action:
        query = query.filter(TrackingRecord.action == action)
    
    # 排序
    sort_column = getattr(TrackingRecord, sort_by, TrackingRecord.created_at)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    return query.offset(skip).limit(limit).all()


@router.get("/records/{id}", response_model=TrackingRecordResponse)
def get_tracking_record(id: int, db: Session = Depends(get_db)):
    """获取单个追踪记录"""
    record = db.query(TrackingRecord).filter(TrackingRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="追踪记录不存在")
    return record


@router.post("/records", response_model=TrackingRecordResponse)
def create_tracking_record(data: TrackingRecordCreate, db: Session = Depends(get_db)):
    """创建追踪记录"""
    record = TrackingRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/records/batch", response_model=List[TrackingRecordResponse])
def create_tracking_records_batch(
    records: List[TrackingRecordCreate], 
    tracking_date: str = Non