"""文献相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_, and_
from typing import List, Optional
from datetime import datetime
from io import StringIO, BytesIO
import csv
import os
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill

from database import get_db
from models.literature import LiteratureEntry, LiteratureTableEntry
from models.attachment import LiteratureAttachment
from models.structured import StructuredLiterature
from models.card import LiteratureCard
from models.note import GeneralNote
from schemas.literature import (
    LiteratureEntryCreate, LiteratureEntryUpdate, LiteratureEntryResponse,
    LiteratureTableEntryCreate, LiteratureTableEntryUpdate, LiteratureTableEntryResponse,
    LiteratureSearchParams
)

router = APIRouter(prefix="/literature", tags=["文献"])


# ==================== Literature Entry CRUD ====================

@router.get("/entries", response_model=List[LiteratureEntryResponse])
def list_literature_entries(
    skip: int = 0, limit: int = 100, 
    search: str = None,
    db: Session = Depends(get_db)
):
    """获取文献条目列表"""
    query = db.query(LiteratureEntry)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                LiteratureEntry.doi.like(search_pattern),
                LiteratureEntry.title_cn.like(search_pattern),
                LiteratureEntry.title_en.like(search_pattern),
                LiteratureEntry.journal.like(search_pattern)
            )
        )
    
    return query.offset(skip).limit(limit).all()


@router.get("/entries/{doi}", response_model=LiteratureEntryResponse)
def get_literature_entry(doi: str, db: Session = Depends(get_db)):
    """获取单个文献条目"""
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献条目不存在")
    return entry


@router.post("/entries", response_model=LiteratureEntryResponse)
def create_literature_entry(data: LiteratureEntryCreate, db: Session = Depends(get_db)):
    """创建文献条目"""
    entry = LiteratureEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/entries/{doi}", response_model=LiteratureEntryResponse)
def update_literature_entry(doi: str, data: LiteratureEntryUpdate, db: Session = Depends(get_db)):
    """更新文献条目"""
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献条目不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    entry.updated_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entries/{doi}")
def delete_literature_entry(doi: str, db: Session = Depends(get_db)):
    """删除文献条目"""
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献条目不存在")
    db.delete(entry)
    db.commit()
    return {"message": "删除成功"}


# ==================== Literature Table CRUD ====================

@router.get("/table", response_model=List[LiteratureTableEntryResponse])
def list_literature_table(
    skip: int = 0, 
    limit: int = 100, 
    search: str = None,
    sort_by: str = Query(default="created_at", regex="^(created_at|pubdate|title_cn|title_en|journal)$"),
    sort_order: str = Query(default="desc", regex="^(asc|desc)$"),
    from_date: str = None,
    until_date: str = None,
    db: Session = Depends(get_db)
):
    """
    获取文献表列表
    
    Args:
        skip: 跳过记录数
        limit: 返回记录数
        search: 搜索关键词
        sort_by: 排序字段
        sort_order: 排序方向
        from_date: 开始日期
        until_date: 结束日期
    """
    query = db.query(LiteratureTableEntry)
    
    # 搜索
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
             