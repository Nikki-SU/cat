"""组织相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
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
def list_tags(skip: int = 0, limit: int = 100, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(Tag)
    if doi:
        query = query.filter(Tag.doi == doi)
    return query.offset(skip).limit(limit).all()

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
