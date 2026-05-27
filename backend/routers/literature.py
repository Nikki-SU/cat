"""文献相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_, and_
from typing import List, Optional
from datetime import datetime
from io import BytesIO
import os

from database import get_db
from models.literature import LiteratureEntry, LiteratureTableEntry
from models.organization import Tag
from schemas.literature import (
    LiteratureEntryCreate, LiteratureEntryUpdate, LiteratureEntryResponse,
    LiteratureTableEntryCreate, LiteratureTableEntryUpdate, LiteratureTableEntryResponse,
    LiteratureSearchParams
)
from services.export_service import export_service

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
def update_literature_entry(doi: str = Path(...), data: LiteratureEntryUpdate = Body(...), db: Session = Depends(get_db)):
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
    sort_by: str = Query(default="created_at", pattern="^(created_at|pubdate|title_cn|title_en|journal)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    from_date: str = None,
    until_date: str = None,
    db: Session = Depends(get_db)
):
    """获取文献表列表"""
    query = db.query(LiteratureTableEntry)
    
    # 搜索
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                LiteratureTableEntry.doi.like(search_pattern),
                LiteratureTableEntry.title_cn.like(search_pattern),
                LiteratureTableEntry.title_en.like(search_pattern),
                LiteratureTableEntry.journal.like(search_pattern),
                LiteratureTableEntry.first_author.like(search_pattern)
            )
        )
    
    # 日期过滤
    if from_date:
        query = query.filter(LiteratureTableEntry.created_at >= from_date)
    if until_date:
        query = query.filter(LiteratureTableEntry.created_at <= until_date)
    
    # 排序
    sort_column = getattr(LiteratureTableEntry, sort_by)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    return query.offset(skip).limit(limit).all()


# ==================== 文献表搜索 - 必须在 /table/{doi} 之前 ====================

@router.get("/table/search")
def search_literature_table(
    q: str,
    search_notes: bool = Query(default=False),
    search_content: bool = Query(default=False),
    db: Session = Depends(get_db)
):
    """搜索文献表"""
    search_pattern = f"%{q}%"
    
    query = db.query(LiteratureTableEntry).filter(
        or_(
            LiteratureTableEntry.doi.like(search_pattern),
            LiteratureTableEntry.title_cn.like(search_pattern),
            LiteratureTableEntry.title_en.like(search_pattern),
            LiteratureTableEntry.journal.like(search_pattern),
            LiteratureTableEntry.first_author.like(search_pattern)
        )
    )
    
    results = query.limit(50).all()
    
    # 如果需要搜索笔记内容
    if search_notes or search_content:
        from models.note import GeneralNote
        from models.structured import StructuredLiterature
        
        note_query = db.query(GeneralNote).filter(
            or_(
                GeneralNote.title.like(search_pattern),
                GeneralNote.content.like(search_pattern) if search_content else False
            )
        ).all()
        
        structured_query = db.query(StructuredLiterature).filter(
            or_(
                StructuredLiterature.content.like(search_pattern) if search_content else False
            )
        ).all()
        
        # 获取关联的DOI
        note_dois = {n.doi for n in note_query if n.doi}
        structured_dois = {s.doi for s in structured_query if s.doi}
        
        # 合并结果
        all_dois = note_dois | structured_dois
        additional_results = db.query(LiteratureTableEntry).filter(
            LiteratureTableEntry.doi.in_(all_dois)
        ).all()
        
        # 去重
        existing_dois = {r.doi for r in results}
        for item in additional_results:
            if item.doi not in existing_dois:
                results.append(item)
    
    return results


# ==================== 导出功能 - 必须在 /table/{doi} 之前 ====================

@router.get("/table/export")
def export_literature_table(
    format: str = Query(default="xlsx", pattern="^(xlsx|csv)$"),
    sort_by: str = Query(default="created_at", pattern="^(created_at|pubdate|title_cn|title_en|journal)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    from_date: str = None,
    until_date: str = None,
    columns: str = None,
    db: Session = Depends(get_db)
):
    """
    导出文献表
    """
    query = db.query(LiteratureTableEntry)
    
    # 日期过滤
    if from_date:
        query = query.filter(LiteratureTableEntry.created_at >= from_date)
    if until_date:
        query = query.filter(LiteratureTableEntry.created_at <= until_date)
    
    # 排序
    sort_column = getattr(LiteratureTableEntry, sort_by)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    entries = [e.__dict__ for e in query.all()]
    
    # 处理列
    column_list = columns.split(",") if columns else None
    
    if format == "csv":
        output = export_service.export_literature_table_csv(
            entries, column_list, sort_by, sort_order, from_date, until_date
        )
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=literature_table.csv"
            }
        )
    else:
        output = export_service.export_literature_table(
            entries, column_list, sort_by, sort_order, from_date, until_date
        )
        return StreamingResponse(
            output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=literature_table.xlsx"
            }
        )


@router.get("/table/export-by-tags")
def export_literature_table_by_tags(
    tags: str,
    format: str = Query(default="xlsx", pattern="^(xlsx|csv)$"),
    sort_by: str = Query(default="created_at", pattern="^(created_at|pubdate|title_cn|title_en|journal)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """
    按标签导出文献表
    """
    from models.organization import Tag, CollectionItem
    
    tag_names = [t.strip() for t in tags.split(",")]
    dois = db.query(Tag.doi).filter(Tag.name.in_(tag_names)).distinct().all()
    dois = [d[0] for d in dois]
    
    query = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi.in_(dois))
    
    # 排序
    sort_column = getattr(LiteratureTableEntry, sort_by)
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    entries = [e.__dict__ for e in query.all()]
    
    if format == "csv":
        output = export_service.export_literature_table_csv(
            entries, None, sort_by, sort_order, None, None
        )
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=literature_by_tags.csv"
            }
        )
    else:
        output = export_service.export_literature_table(
            entries, None, sort_by, sort_order, None, None
        )
        return StreamingResponse(
            output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=literature_by_tags.xlsx"
            }
        )


# ==================== /table/{doi} 及其相关操作 - 必须在特殊路由之后 ====================

@router.get("/table/{doi}/details")
def get_literature_table_entry_details(doi: str, db: Session = Depends(get_db)):
    """获取文献详情（含关联状态）"""
    from models.attachment import LiteratureAttachment
    from models.structured import StructuredLiterature
    from models.card import LiteratureCard
    from models.note import GeneralNote
    from models.organization import Tag
    
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献不存在")
    
    attachments = db.query(LiteratureAttachment).filter(LiteratureAttachment.doi == doi).count()
    has_structured = db.query(StructuredLiterature).filter(StructuredLiterature.doi == doi).first() is not None
    has_card = db.query(LiteratureCard).filter(LiteratureCard.doi == doi).first() is not None
    has_notes = db.query(GeneralNote).filter(GeneralNote.doi == doi).count() > 0
    tags = db.query(Tag).filter(Tag.doi == doi).all()
    
    return {
        **entry.__dict__,
        "attachments_count": attachments,
        "has_structured": has_structured,
        "has_card": has_card,
        "has_notes": has_notes,
        "tags": tags
    }


@router.get("/table/{doi}", response_model=LiteratureTableEntryResponse)
def get_literature_table_entry(doi: str, db: Session = Depends(get_db)):
    """获取单个文献表条目"""
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献不存在")
    return entry


@router.post("/table", response_model=LiteratureTableEntryResponse)
def create_literature_table_entry(data: LiteratureTableEntryCreate, db: Session = Depends(get_db)):
    """创建文献表条目"""
    entry = LiteratureTableEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/table/batch")
def batch_create_literature_table_entries(
    entries: List[LiteratureTableEntryCreate],
    db: Session = Depends(get_db)
):
    """批量创建文献表条目"""
    created = []
    for data in entries:
        # 检查是否已存在
        existing = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == data.doi).first()
        if not existing:
            entry = LiteratureTableEntry(**data.model_dump())
            db.add(entry)
            created.append(entry)
    
    db.commit()
    for entry in created:
        db.refresh(entry)
    
    return {"created": len(created), "entries": created}


@router.put("/table/{doi}", response_model=LiteratureTableEntryResponse)
def update_literature_table_entry(doi: str = Path(...), data: LiteratureTableEntryUpdate = Body(...), db: Session = Depends(get_db)):
    """更新文献表条目"""
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    entry.updated_at = datetime.now()
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/table/{doi}")
def delete_literature_table_entry(
    doi: str, 
    cascade: bool = Query(default=False),
    db: Session = Depends(get_db)
):
    """删除文献表条目"""
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献不存在")
    
    if cascade:
        # 级联删除关联数据
        from models.attachment import LiteratureAttachment
        from models.structured import StructuredLiterature
        from models.card import LiteratureCard
        from models.note import GeneralNote
        from models.organization import Tag, CollectionItem
        
        # 删除附件
        db.query(LiteratureAttachment).filter(LiteratureAttachment.doi == doi).delete()
        # 删除结构化文献
        db.query(StructuredLiterature).filter(StructuredLiterature.doi == doi).delete()
        # 删除文献卡片
        db.query(LiteratureCard).filter(LiteratureCard.doi == doi).delete()
        # 删除笔记
        db.query(GeneralNote).filter(GeneralNote.doi == doi).delete()
        # 删除标签
        db.query(Tag).filter(Tag.doi == doi).delete()
        # 删除合集条目
        db.query(CollectionItem).filter(CollectionItem.doi == doi).delete()
    
    db.delete(entry)
    db.commit()
    return {"message": "删除成功"}
