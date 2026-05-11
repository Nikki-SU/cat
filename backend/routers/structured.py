"""结构性文献相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.structured import StructuredLiterature, StructuredNote
from models.learning import LongSentence
from schemas.structured import (
    StructuredLiteratureCreate, StructuredLiteratureUpdate, StructuredLiteratureResponse,
    StructuredNoteCreate, StructuredNoteUpdate, StructuredNoteResponse
)
from services.ai_service import get_ai_service

router = APIRouter(prefix="/structured", tags=["结构性文献"])

# Structured Literature CRUD
@router.get("/literature", response_model=List[StructuredLiteratureResponse])
def list_structured_literatures(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(StructuredLiterature).offset(skip).limit(limit).all()

@router.get("/literature/{doi}", response_model=StructuredLiteratureResponse)
def get_structured_literature(doi: str, db: Session = Depends(get_db)):
    item = db.query(StructuredLiterature).filter(StructuredLiterature.doi == doi).first()
    if not item:
        raise HTTPException(status_code=404, detail="结构性文献不存在")
    return item

@router.post("/literature", response_model=StructuredLiteratureResponse)
def create_structured_literature(data: StructuredLiteratureCreate, db: Session = Depends(get_db)):
    item = StructuredLiterature(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/literature/{doi}", response_model=StructuredLiteratureResponse)
def update_structured_literature(doi: str, data: StructuredLiteratureUpdate, db: Session = Depends(get_db)):
    item = db.query(StructuredLiterature).filter(StructuredLiterature.doi == doi).first()
    if not item:
        raise HTTPException(status_code=404, detail="结构性文献不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/literature/{doi}")
def delete_structured_literature(doi: str, db: Session = Depends(get_db)):
    item = db.query(StructuredLiterature).filter(StructuredLiterature.doi == doi).first()
    if not item:
        raise HTTPException(status_code=404, detail="结构性文献不存在")
    db.delete(item)
    db.commit()
    return {"message": "删除成功"}

# Structured Note CRUD
@router.get("/notes", response_model=List[StructuredNoteResponse])
def list_structured_notes(skip: int = 0, limit: int = 100, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(StructuredNote)
    if doi:
        query = query.filter(StructuredNote.doi == doi)
    return query.offset(skip).limit(limit).all()

@router.get("/notes/{id}", response_model=StructuredNoteResponse)
def get_structured_note(id: int, db: Session = Depends(get_db)):
    note = db.query(StructuredNote).filter(StructuredNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="结构性笔记不存在")
    return note

@router.post("/notes", response_model=StructuredNoteResponse)
def create_structured_note(data: StructuredNoteCreate, db: Session = Depends(get_db)):
    note = StructuredNote(**data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.put("/notes/{id}", response_model=StructuredNoteResponse)
def update_structured_note(id: int, data: StructuredNoteUpdate, db: Session = Depends(get_db)):
    note = db.query(StructuredNote).filter(StructuredNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="结构性笔记不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note

@router.delete("/notes/{id}")
def delete_structured_note(id: int, db: Session = Depends(get_db)):
    note = db.query(StructuredNote).filter(StructuredNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="结构性笔记不存在")
    db.delete(note)
    db.commit()
    return {"message": "删除成功"}


# ==================== 长难句提取 ====================

@router.post("/extract-sentences/{doi}")
async def extract_long_sentences(
    doi: str,
    db: Session = Depends(get_db),
    max_sentences: int = 10
):
    """
    从结构性文献中提取长难句并翻译
    
    Args:
        doi: 文献DOI
        max_sentences: 最大提取数量
        
    Returns:
        提取结果 {success, count, sentences: [{id, sentence_en, sentence_cn, word_count}], error}
    """
    # 1. 获取结构性文献内容
    structured_lit = db.query(StructuredLiterature).filter(
        StructuredLiterature.doi == doi
    ).first()
    
    if not structured_lit:
        raise HTTPException(status_code=404, detail="未找到对应的结构性文献")
    
    # 获取markdown内容
    markdown_content = ""
    if structured_lit.content:
        markdown_content = structured_lit.content
    elif structured_lit.markdown:
        markdown_content = structured_lit.markdown
    
    if not markdown_content:
        return {
            "success": False,
            "error": "结构性文献内容为空",
            "count": 0,
            "sentences": []
        }
    
    # 2. 调用AI服务提取长难句
    ai_service = get_ai_service()
    extract_result = await ai_service.extract_long_sentences(markdown_content, doi)
    
    if not extract_result.get("success"):
        return {
            "success": False,
            "error": extract_result.get("error", "AI提取失败"),
            "count": 0,
            "sentences": []
        }
    
    # 3. 保存到LongSentence表
    sentences_data = extract_result.get("sentences", [])[:max_sentences]
    created_sentences = []
    
    for sentence_data in sentences_data:
        sentence_en = sentence_data.get("sentence_en", "")
        if not sentence_en:
            continue
        
        # 检查是否已存在
        existing = db.query(LongSentence).filter(
            LongSentence.doi == doi,
            LongSentence.sentence_en == sentence_en
        ).first()
        
        if existing:
            # 更新翻译
            if sentence_data.get("sentence_cn") and not existing.sentence_cn:
                existing.sentence_cn = sentence_data.get("sentence_cn")
                db.commit()
                db.refresh(existing)
            created_sentences.append(existing)
        else:
            # 创建新记录
            new_sentence = LongSentence(
                doi=doi,
                sentence_en=sentence_en,
                sentence_cn=sentence_data.get("sentence_cn"),
                status="new"
            )
            db.add(new_sentence)
            created_sentences.append(new_sentence)
    
    db.commit()
    for sentence in created_sentences:
        db.refresh(sentence)
    
    return {
        "success": True,
        "count": len(created_sentences),
        "sentences": [
            {
                "id": s.id,
                "sentence_en": s.sentence_en,
                "sentence_cn": s.sentence_cn,
                "word_count": len(s.sentence_en.split()) if s.sentence_en else 0
            }
            for s in created_sentences
        ]
    }


@router.post("/extract-keywords/{doi}")
async def extract_keywords(
    doi: str,
    db: Session = Depends(get_db),
    max_keywords: int = 20
):
    """
    从结构性文献中提取关键词
    
    Args:
        doi: 文献DOI
        max_keywords: 最大提取数量
        
    Returns:
        提取结果 {success, count, keywords: [{keyword, translation, frequency, category}], error}
    """
    # 1. 获取结构性文献内容
    structured_lit = db.query(StructuredLiterature).filter(
        StructuredLiterature.doi == doi
    ).first()
    
    if not structured_lit:
        raise HTTPException(status_code=404, detail="未找到对应的结构性文献")
    
    # 获取markdown内容
    markdown_content = ""
    if structured_lit.content:
        markdown_content = structured_lit.content
    elif structured_lit.markdown:
        markdown_content = structured_lit.markdown
    
    if not markdown_content:
        return {
            "success": False,
            "error": "结构性文献内容为空",
            "count": 0,
            "keywords": []
        }
    
    # 2. 调用AI服务提取关键词
    ai_service = get_ai_service()
    extract_result = await ai_service.extract_keywords(markdown_content, doi, count=max_keywords)
    
    if not extract_result.get("success"):
        return {
            "success": False,
            "error": extract_result.get("error", "AI提取失败"),
            "count": 0,
            "keywords": []
        }
    
    return {
        "success": True,
        "count": len(extract_result.get("keywords", [])),
        "keywords": extract_result.get("keywords", [])
    }
