"""追踪相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Path, Body, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from typing import List, Optional
from datetime import datetime
from io import StringIO, BytesIO
import csv
import asyncio

from database import get_db
from models.tracking import TrackingRecord
from models.literature import LiteratureTableEntry, LiteratureEntry
from schemas.tracking import (
    TrackingRecordCreate, TrackingRecordUpdate, TrackingRecordResponse,
    JournalValidationResult, JournalValidationRequest, TrackingSearchResult
)
from services.crossref_service import get_crossref_service, CrossRefService
from services.ai_service import get_ai_service

router = APIRouter(prefix="/tracking", tags=["追踪"])


def get_crossref() -> CrossRefService:
    return get_crossref_service()


def get_ai():
    return get_ai_service()


# ==================== 追踪记录 CRUD ====================

@router.get("/records", response_model=List[TrackingRecordResponse])
def list_tracking_records(
    skip: int = 0, 
    limit: int = 100,
    journal: Optional[str] = None, 
    action: Optional[str] = None,
    sort_by: str = "created_at", 
    sort_order: str = "desc",
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
    tracking_date: str = Query(..., description="追踪日期 (YYYY-MM-DD格式)"),
    db: Session = Depends(get_db)
):
    """批量创建追踪记录"""
    created_records = []
    for record_data in records:
        record_dict = record_data.model_dump()
        record_dict["date"] = tracking_date
        record = TrackingRecord(**record_dict)
        db.add(record)
        created_records.append(record)
    
    db.commit()
    for record in created_records:
        db.refresh(record)
    
    return created_records


@router.put("/records/{id}", response_model=TrackingRecordResponse)
def update_tracking_record(id: int, data: TrackingRecordUpdate, db: Session = Depends(get_db)):
    """更新追踪记录"""
    record = db.query(TrackingRecord).filter(TrackingRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="追踪记录不存在")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)
    
    db.commit()
    db.refresh(record)
    return record


@router.delete("/records/{id}")
def delete_tracking_record(id: int, db: Session = Depends(get_db)):
    """删除追踪记录"""
    record = db.query(TrackingRecord).filter(TrackingRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="追踪记录不存在")
    
    db.delete(record)
    db.commit()
    return {"message": "删除成功"}


# ==================== 按条件查询 ====================

@router.get("/records/by-journal/{journal}", response_model=List[TrackingRecordResponse])
def get_records_by_journal(
    journal: str, 
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """按期刊名查询追踪记录"""
    query = db.query(TrackingRecord).filter(TrackingRecord.journal == journal)
    return query.order_by(desc(TrackingRecord.created_at)).offset(skip).limit(limit).all()


@router.get("/records/by-date/{date}", response_model=List[TrackingRecordResponse])
def get_records_by_date(
    date: str, 
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """按日期查询追踪记录"""
    query = db.query(TrackingRecord).filter(TrackingRecord.date == date)
    return query.order_by(desc(TrackingRecord.created_at)).offset(skip).limit(limit).all()


@router.get("/records/dates", response_model=List[str])
def get_all_tracking_dates(db: Session = Depends(get_db)):
    """获取所有追踪日期列表"""
    dates = db.query(TrackingRecord.date).distinct().filter(
        TrackingRecord.date.isnot(None)
    ).order_by(desc(TrackingRecord.date)).all()
    return [d[0] for d in dates if d[0]]


# ==================== 期刊验证与搜索 ====================

@router.post("/validate-journals", response_model=List[JournalValidationResult])
async def validate_journals(
    request: JournalValidationRequest,
    crossref: CrossRefService = Depends(get_crossref)
):
    """验证期刊名有效性"""
    results = []
    
    for journal_name in request.journals:
        try:
            # 使用期刊名搜索获取ISSN和文章数
            issn = await crossref._get_journal_issn(journal_name)
            
            if issn:
                # 获取近期文章数量
                articles = await crossref.search_by_journal_issn(
                    issn=issn, 
                    rows=5
                )
                results.append(JournalValidationResult(
                    journal_name=journal_name,
                    is_valid=True,
                    article_count=len(articles),
                    issn=issn
                ))
            else:
                results.append(JournalValidationResult(
                    journal_name=journal_name,
                    is_valid=False,
                    article_count=0
                ))
        except Exception as e:
            results.append(JournalValidationResult(
                journal_name=journal_name,
                is_valid=False,
                article_count=0
            ))
    
    return results


@router.get("/search/by-doi/{doi}", response_model=TrackingSearchResult)
async def search_by_doi(
    doi: str,
    translate_abstract: bool = Query(False, description="是否翻译摘要"),
    crossref: CrossRefService = Depends(get_crossref)
):
    """通过DOI搜索文献信息"""
    result = await crossref.search_and_translate_abstract(doi, translate_abstract=translate_abstract)
    
    if not result:
        raise HTTPException(status_code=404, detail="未找到该DOI对应的文献")
    
    return TrackingSearchResult(
        doi=result.get("doi"),
        title_en=result.get("title_en"),
        title_cn=None,
        journal=result.get("journal"),
        author=result.get("first_author"),
        pubdate=result.get("pubdate"),
        abstract_en=result.get("abstract_en"),
        abstract_cn=result.get("abstract_cn")  # 已翻译的中文摘要
    )


@router.post("/search/by-journal", response_model=List[TrackingSearchResult])
async def search_by_journal(
    journal_name: str = Query(..., description="期刊名称"),
    keywords: Optional[str] = Query(None, description="关键词JSON数组，格式: [{word, logic}]"),
    from_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    until_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    rows: int = Query(100, description="返回数量"),
    translate_abstract: bool = Query(False, description="是否翻译摘要"),
    crossref: CrossRefService = Depends(get_crossref)
):
    """
    通过期刊名搜索文献
    
    关键词格式（JSON数组）:
    [
        {"word": "machine learning", "logic": "and"},
        {"word": "deep learning", "logic": "or"},
        {"word": "survey", "logic": "not"}
    ]
    
    逻辑说明:
    - and: 文献必须包含该关键词
    - or: 文献包含该关键词即可（默认）
    - not: 文献必须排除该关键词
    """
    import json
    
    # 兼容空keywords数组字符串
    if keywords and keywords in ('[]', ''):
        keywords = None
    
    keyword_list = None
    if keywords:
        try:
            keyword_list = json.loads(keywords)
            # 验证格式
            if not isinstance(keyword_list, list):
                keyword_list = None
            else:
                # 确保每项都有 word 字段
                keyword_list = [
                    {"word": k.get("word", ""), "logic": k.get("logic", "or")}
                    for k in keyword_list if k.get("word")
                ]
        except json.JSONDecodeError:
            # 如果不是 JSON，尝试逗号分隔的旧格式
            keyword_list = [{"word": k.strip(), "logic": "or"} for k in keywords.split(",")]
    
    results = await crossref.search_by_journal_name(
        journal_name=journal_name,
        keywords=keyword_list,
        from_date=from_date,
        until_date=until_date,
        rows=rows
    )
    
    # 如果需要翻译摘要
    if translate_abstract:
        for result in results:
            if result.get("abstract_en"):
                abstract_cn = await crossref.translate_abstract(result["abstract_en"])
                if abstract_cn:
                    result["abstract_cn"] = abstract_cn
    
    return [
        TrackingSearchResult(
            doi=r.get("doi"),
            title_en=r.get("title_en"),
            title_cn=None,
            journal=r.get("journal"),
            author=r.get("first_author"),
            pubdate=r.get("pubdate"),
            abstract_en=r.get("abstract_en"),
            abstract_cn=r.get("abstract_cn")
        )
        for r in results
    ]


@router.post("/add-by-doi", response_model=TrackingRecordResponse)
async def add_by_doi(
    doi: str = Query(..., description="DOI标识符"),
    tracking_date: str = Query(..., description="追踪日期 YYYY-MM-DD"),
    translate_title: bool = Query(True, description="是否翻译标题"),
    translate_abstract: bool = Query(False, description="是否翻译摘要"),
    db: Session = Depends(get_db)
):
    """通过DOI直接添加文献到追踪列表（自动获取信息并翻译）"""
    try:
        crossref = get_crossref()
        ai = get_ai_service()
        
        # 1. 获取DOI信息（含可选摘要翻译）
        paper_info = await crossref.search_and_translate_abstract(doi, translate_abstract=translate_abstract)
        if not paper_info:
            raise HTTPException(status_code=404, detail="未找到该DOI对应的文献，请检查DOI或网络")
        
        title_en = paper_info.get("title_en", "")
        journal = paper_info.get("journal", "")
        abstract_en = paper_info.get("abstract_en")
        abstract_cn = paper_info.get("abstract_cn")
        
        # 2. 翻译标题（如果需要）
        title_cn = None
        if translate_title and title_en:
            try:
                prompt = f"""请将以下学术论文标题翻译成中文，只需返回翻译结果，不需要其他解释：

标题：{title_en}

期刊：{journal}"""
                
                translated = await ai.chat(
                    messages=[{"role": "user", "content": prompt}],
                    system="你是一个专业的学术翻译助手，擅长翻译学术论文标题。要求翻译准确、专业、简洁。"
                )
                
                if translated and not translated.startswith("翻译失败"):
                    title_cn = translated.strip()
            except Exception as e:
                print(f"翻译失败: {e}")
                title_cn = None
        
        # 3. 创建或更新文献表记录
        existing_entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
        if not existing_entry:
            authors = paper_info.get("authors", "")
            first_author = ""
            if authors:
                author_list = [a.strip() for a in authors.split(",")]
                if author_list:
                    first_author = author_list[0]
            
            pub_date = paper_info.get("published_date", "")
            
            table_entry = LiteratureTableEntry(
                doi=doi,
                title_cn=title_cn,
                title_en=title_en,
                journal=journal,
                pubdate=pub_date,
                first_author=first_author,
                has_attachment=False,
                has_structured=False,
                has_card=False,
                has_notes=False,
            )
            db.add(table_entry)
        else:
            if title_cn:
                existing_entry.title_cn = title_cn
            if title_en:
                existing_entry.title_en = title_en
        
        # 4. 创建追踪记录
        record = TrackingRecord(
            date=tracking_date,
            journal=journal,
            title_cn=title_cn,
            title_en=title_en,
            doi=doi,
            action="added"
        )
        
        db.add(record)
        db.commit()
        db.refresh(record)
        
        return record
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"添加文献失败: {str(e)}")


# ==================== 导出功能 ====================

@router.get("/export/csv")
def export_tracking_csv(
    journal: Optional[str] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """导出追踪记录为CSV"""
    query = db.query(TrackingRecord)
    
    if journal:
        query = query.filter(TrackingRecord.journal == journal)
    if date:
        query = query.filter(TrackingRecord.date == date)
    
    records = query.order_by(desc(TrackingRecord.date)).all()
    
    # 创建CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["日期", "期刊", "标题(中文)", "标题(英文)", "DOI", "操作", "创建时间"])
    
    for r in records:
        writer.writerow([
            r.date or "",
            r.journal or "",
            r.title_cn or "",
            r.title_en or "",
            r.doi or "",
            r.action or "",
            r.created_at.isoformat() if r.created_at else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tracking_records.csv"}
    )


@router.get("/statistics")
def get_tracking_statistics(db: Session = Depends(get_db)):
    """获取追踪统计信息"""
    total = db.query(TrackingRecord).count()
    
    # 按期刊统计
    journal_stats = db.query(
        TrackingRecord.journal,
        func.count(TrackingRecord.id).label("count")
    ).group_by(TrackingRecord.journal).all()
    
    # 按日期统计
    date_stats = db.query(
        TrackingRecord.date,
        func.count(TrackingRecord.id).label("count")
    ).filter(TrackingRecord.date.isnot(None)).group_by(TrackingRecord.date).all()
    
    # 按操作统计
    action_stats = db.query(
        TrackingRecord.action,
        func.count(TrackingRecord.id).label("count")
    ).group_by(TrackingRecord.action).all()
    
    return {
        "total": total,
        "by_journal": [{"journal": j, "count": c} for j, c in journal_stats],
        "by_date": [{"date": d, "count": c} for d, c in date_stats],
        "by_action": [{"action": a, "count": c} for a, c in action_stats]
    }
