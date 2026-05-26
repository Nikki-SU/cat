"""组织相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.organization import Tag, Collection, CollectionItem, JournalGroup, KeywordGroup
from schemas.organization import (
    TagCreate, TagUpdate, TagResponse,
    CollectionCreate, CollectionUpdate, CollectionResponse,
    CollectionItemCreate, CollectionItemUpdate, CollectionItemResponse,
    JournalGroupCreate, JournalGroupUpdate, JournalGroupResponse,
    KeywordGroupCreate, KeywordGroupUpdate, KeywordGroupResponse
)

router = APIRouter(prefix="/organization", tags=["组织"])

# Tag CRUD
@router.get("/tags", response_model=List[TagResponse])
def list_tags(skip: int = 0, limit: int = 100, doi: str = None, name: str = None, db: Session = Depends(get_db)):
    query = db.query(Tag)
    if doi:
        query = query.filter(Tag.doi == doi)
    if name:
        query = query.filter(Tag.name.like(f"%{name}%"))
    return query.offset(skip).limit(limit).all()


# Tag 固定路径路由（必须在 /tags/{id} 之前，否则 <built-in function id> 会拦截）
@router.get("/tags/all-names", response_model=List[str])
def get_all_tag_names(db: Session = Depends(get_db)):
    """获取所有不重复的标签名（用于自动补全）"""
    tags = db.query(Tag.name).distinct().all()
    return [t[0] for t in tags]

@router.get("/tags/by-doi/{doi}", response_model=List[TagResponse])
def get_tags_by_doi(doi: str, db: Session = Depends(get_db)):
    """获取某DOI下的所有标签"""
    return db.query(Tag).filter(Tag.doi == doi).all()

@router.get("/tags/by-name/{name}", response_model=List[TagResponse])
def get_tags_by_name(name: str, db: Session = Depends(get_db)):
    """获取某标签名下的所有DOI"""
    return db.query(Tag).filter(Tag.name == name).all()

@router.post("/tags/batch", response_model=List[TagResponse])
def batch_create_tags(tags_data: List[TagCreate], db: Session = Depends(get_db)):
    """批量创建标签"""
    tags = []
    for data in tags_data:
        tag = Tag(**data.model_dump())
        db.add(tag)
        tags.append(tag)
    db.commit()
    for tag in tags:
        db.refresh(tag)
    return tags

@router.get("/tags/{id}", response_model=TagResponse)
def get_tag(id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    return tag

@router.post("/tags", response_model=TagResponse)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    tag = Tag(**data.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag

@router.put("/tags/{id}", response_model=TagResponse)
def update_tag(id: int, data: TagUpdate, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tag, key, value)
    db.commit()
    db.refresh(tag)
    return tag

@router.delete("/tags/{id}")
def delete_tag(id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    db.delete(tag)
    db.commit()
    return {"message": "删除成功"}

# Tag 增强功能


# Collection CRUD
@router.get("/collections", response_model=List[CollectionResponse])
def list_collections(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Collection).offset(skip).limit(limit).all()

@router.get("/collections/{id}", response_model=CollectionResponse)
def get_collection(id: int, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")
    return collection

@router.post("/collections", response_model=CollectionResponse)
def create_collection(data: CollectionCreate, db: Session = Depends(get_db)):
    collection = Collection(**data.model_dump())
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection

@router.put("/collections/{id}", response_model=CollectionResponse)
def update_collection(id: int, data: CollectionUpdate, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(collection, key, value)
    db.commit()
    db.refresh(collection)
    return collection

@router.delete("/collections/{id}")
def delete_collection(id: int, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")
    # 删除关联的条目
    db.query(CollectionItem).filter(CollectionItem.collection_id == id).delete()
    db.delete(collection)
    db.commit()
    return {"message": "删除成功"}

# Collection 增强功能
@router.get("/collections/{id}/items", response_model=List[CollectionItemResponse])
def get_collection_items(id: int, db: Session = Depends(get_db)):
    """获取合集中的所有条目"""
    return db.query(CollectionItem).filter(CollectionItem.collection_id == id).all()

@router.post("/collections/{id}/items", response_model=CollectionItemResponse)
def add_item_to_collection(id: int, data: CollectionItemCreate, db: Session = Depends(get_db)):
    """向合集添加条目"""
    collection = db.query(Collection).filter(Collection.id == id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="合集不存在")
    item = CollectionItem(**{**data.model_dump(), "collection_id": id})
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/collections/{id}/items/{item_id}")
def remove_item_from_collection(id: int, item_id: int, db: Session = Depends(get_db)):
    """从合集移除条目"""
    item = db.query(CollectionItem).filter(
        CollectionItem.id == item_id,
        CollectionItem.collection_id == id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="合集条目不存在")
    db.delete(item)
    db.commit()
    return {"message": "移除成功"}

@router.get("/collections/{id}/filter")
def filter_collection_items(
    id: int,
    tag: str = None,
    item_type: str = None,
    db: Session = Depends(get_db)
):
    """按标签或数据类型筛选合集内条目"""
    query = db.query(CollectionItem).filter(CollectionItem.collection_id == id)
    
    if item_type:
        query = query.filter(CollectionItem.item_type == item_type)
    
    items = query.all()
    
    if tag:
        tag_records = db.query(Tag).filter(Tag.name == tag).all()
        tag_dois = {t.doi for t in tag_records if t.doi}
        items = [item for item in items if item.doi in tag_dois]
    
    return items

# Collection Item CRUD
@router.get("/collection-items", response_model=List[CollectionItemResponse])
def list_collection_items(skip: int = 0, limit: int = 100, collection_id: int = None, db: Session = Depends(get_db)):
    query = db.query(CollectionItem)
    if collection_id:
        query = query.filter(CollectionItem.collection_id == collection_id)
    return query.offset(skip).limit(limit).all()

@router.get("/collection-items/{id}", response_model=CollectionItemResponse)
def get_collection_item(id: int, db: Session = Depends(get_db)):
    item = db.query(CollectionItem).filter(CollectionItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="合集条目不存在")
    return item

@router.post("/collection-items", response_model=CollectionItemResponse)
def create_collection_item(data: CollectionItemCreate, db: Session = Depends(get_db)):
    item = CollectionItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/collection-items/{id}", response_model=CollectionItemResponse)
def update_collection_item(id: int, data: CollectionItemUpdate, db: Session = Depends(get_db)):
    item = db.query(CollectionItem).filter(CollectionItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="合集条目不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/collection-items/{id}")
def delete_collection_item(id: int, db: Session = Depends(get_db)):
    item = db.query(CollectionItem).filter(CollectionItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="合集条目不存在")
    db.delete(item)
    db.commit()
    return {"message": "删除成功"}

# Journal Group CRUD
@router.get("/journal-groups", response_model=List[JournalGroupResponse])
def list_journal_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(JournalGroup).offset(skip).limit(limit).all()

@router.get("/journal-groups/{id}", response_model=JournalGroupResponse)
def get_journal_group(id: int, db: Session = Depends(get_db)):
    group = db.query(JournalGroup).filter(JournalGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="期刊合集不存在")
    return group

@router.post("/journal-groups", response_model=JournalGroupResponse)
def create_journal_group(data: JournalGroupCreate, db: Session = Depends(get_db)):
    group = JournalGroup(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.put("/journal-groups/{id}", response_model=JournalGroupResponse)
def update_journal_group(id: int, data: JournalGroupUpdate, db: Session = Depends(get_db)):
    group = db.query(JournalGroup).filter(JournalGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="期刊合集不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/journal-groups/{id}")
def delete_journal_group(id: int, db: Session = Depends(get_db)):
    group = db.query(JournalGroup).filter(JournalGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="期刊合集不存在")
    db.delete(group)
    db.commit()
    return {"message": "删除成功"}

@router.post("/journal-groups/{id}/validate")
async def validate_journal_group(id: int, db: Session = Depends(get_db)):
    """验证合集内期刊名有效性"""
    from services.crossref_service import get_crossref_service
    from services.ai_service import get_ai_service
    
    group = db.query(JournalGroup).filter(JournalGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="期刊合集不存在")
    
    crossref = get_crossref_service()
    ai = get_ai_service()
    journals = group.journals or []
    
    results = []
    for journal in journals:
        works = await crossref.search_by_journal(journal, max_results=1)
        is_valid = len(works) > 0
        
        suggestion = None
        if not is_valid:
            correction = await ai.suggest_journal_correction(journal)
            if correction.get("success"):
                suggestion = correction.get("suggestion")
        
        results.append({
            "journal": journal,
            "valid": is_valid,
            "suggestion": suggestion,
            "works_count": len(works) if is_valid else 0
        })
    
    return {
        "group_id": id,
        "group_name": group.name,
        "results": results,
        "valid_count": sum(1 for r in results if r["valid"]),
        "invalid_count": sum(1 for r in results if not r["valid"])
    }

# Keyword Group CRUD
@router.get("/keyword-groups", response_model=List[KeywordGroupResponse])
def list_keyword_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(KeywordGroup).offset(skip).limit(limit).all()

@router.get("/keyword-groups/{id}", response_model=KeywordGroupResponse)
def get_keyword_group(id: int, db: Session = Depends(get_db)):
    group = db.query(KeywordGroup).filter(KeywordGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="关键词合集不存在")
    return group

@router.post("/keyword-groups", response_model=KeywordGroupResponse)
def create_keyword_group(data: KeywordGroupCreate, db: Session = Depends(get_db)):
    group = KeywordGroup(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.put("/keyword-groups/{id}", response_model=KeywordGroupResponse)
def update_keyword_group(id: int, data: KeywordGroupUpdate, db: Session = Depends(get_db)):
    group = db.query(KeywordGroup).filter(KeywordGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="关键词合集不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/keyword-groups/{id}")
def delete_keyword_group(id: int, db: Session = Depends(get_db)):
    group = db.query(KeywordGroup).filter(KeywordGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="关键词合集不存在")
    db.delete(group)
    db.commit()
    return {"message": "删除成功"}
