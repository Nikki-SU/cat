"""追踪相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.tracking import TrackingRecord
from schemas.tracking import TrackingRecordCreate, TrackingRecordUpdate, TrackingRecordResponse

router = APIRouter(prefix="/tracking", tags=["追踪"])

@router.get("/records", response_model=List[TrackingRecordResponse])
def list_tracking_records(
    skip: int = 0, limit: int = 100,
    journal: Optional[str] = None, action: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TrackingRecord)
    if journal:
        query = query.filter(TrackingRecord.journal == journal)
    if action:
        query = query.filter(TrackingRecord.action == action)
    return query.order_by(TrackingRecord.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/records/{id}", response_model=TrackingRecordResponse)
def get_tracking_record(id: int, db: Session = Depends(get_db)):
    record = db.query(TrackingRecord).filter(TrackingRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="追踪记录不存在")
    return record

@router.post("/records", response_model=TrackingRecordResponse)
def create_tracking_record(data: TrackingRecordCreate, db: Session = Depends(get_db)):
    record = TrackingRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.put("/records/{id}", response_model=TrackingRecordResponse)
def update_tracking_record(id: int, data: TrackingRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(TrackingRecord).filter(TrackingRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="追踪记录不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record

@router.delete("/records/{id}")
def delete_tracking_record(id: int, db: Session = Depends(get_db)):
    record = db.query(TrackingRecord).filter(TrackingRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="追踪记录不存在")
    db.delete(record)
    db.commit()
    return {"message": "删除成功"}

@router.get("/records/by-journal/{journal}", response_model=List[TrackingRecordResponse])
def get_records_by_journal(journal: str, db: Session = Depends(get_db)):
    return db.query(TrackingRecord).filter(TrackingRecord.journal == journal).all()
