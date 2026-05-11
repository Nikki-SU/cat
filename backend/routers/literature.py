"""文献相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.literature import LiteratureEntry, LiteratureTableEntry
from schemas.literature import (
    LiteratureEntryCreate, LiteratureEntryUpdate, LiteratureEntryResponse,
    LiteratureTableEntryCreate, LiteratureTableEntryUpdate, LiteratureTableEntryResponse
)

router = APIRouter(prefix="/literature", tags=["文献"])

# Literature Entry CRUD
@router.get("/entries", response_model=List[LiteratureEntryResponse])
def list_literature_entries(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(LiteratureEntry).offset(skip).limit(limit).all()

@router.get("/entries/{doi}", response_model=LiteratureEntryResponse)
def get_literature_entry(doi: str, db: Session = Depends(get_db)):
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献条目不存在")
    return entry

@router.post("/entries", response_model=LiteratureEntryResponse)
def create_literature_entry(data: LiteratureEntryCreate, db: Session = Depends(get_db)):
    entry = LiteratureEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.put("/entries/{doi}", response_model=LiteratureEntryResponse)
def update_literature_entry(doi: str, data: LiteratureEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献条目不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/entries/{doi}")
def delete_literature_entry(doi: str, db: Session = Depends(get_db)):
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献条目不存在")
    db.delete(entry)
    db.commit()
    return {"message": "删除成功"}

# Literature Table Entry CRUD
@router.get("/table", response_model=List[LiteratureTableEntryResponse])
def list_literature_table(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(LiteratureTableEntry).order_by(LiteratureTableEntry.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/table/{doi}", response_model=LiteratureTableEntryResponse)
def get_literature_table_entry(doi: str, db: Session = Depends(get_db)):
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献表条目不存在")
    return entry

@router.post("/table", response_model=LiteratureTableEntryResponse)
def create_literature_table_entry(data: LiteratureTableEntryCreate, db: Session = Depends(get_db)):
    entry = LiteratureTableEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.put("/table/{doi}", response_model=LiteratureTableEntryResponse)
def update_literature_table_entry(doi: str, data: LiteratureTableEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献表条目不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/table/{doi}")
def delete_literature_table_entry(doi: str, cascade: bool = False, db: Session = Depends(get_db)):
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献表条目不存在")
    # 简单的级联删除提示，实际级联需要配置关系
    if cascade:
        # 删除关联的附件、结构性文献、卡片等
        db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).delete()
    db.delete(entry)
    db.commit()
    return {"message": "删除成功"}
