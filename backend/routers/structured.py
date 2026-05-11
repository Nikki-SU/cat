"""结构性文献相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.structured import StructuredLiterature, StructuredNote
from schemas.structured import (
    StructuredLiteratureCreate, StructuredLiteratureUpdate, StructuredLiteratureResponse,
    StructuredNoteCreate, StructuredNoteUpdate, StructuredNoteResponse
)

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
