"""笔记相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.note import GeneralNote, NoteTemplate
from schemas.note import (
    GeneralNoteCreate, GeneralNoteUpdate, GeneralNoteResponse,
    NoteTemplateCreate, NoteTemplateUpdate, NoteTemplateResponse
)

router = APIRouter(prefix="/notes", tags=["笔记"])

# General Note CRUD
@router.get("/general", response_model=List[GeneralNoteResponse])
def list_general_notes(skip: int = 0, limit: int = 100, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(GeneralNote)
    if doi:
        query = query.filter(GeneralNote.doi == doi)
    return query.order_by(GeneralNote.updated_at.desc()).offset(skip).limit(limit).all()

@router.get("/general/{id}", response_model=GeneralNoteResponse)
def get_general_note(id: int, db: Session = Depends(get_db)):
    note = db.query(GeneralNote).filter(GeneralNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note

@router.post("/general", response_model=GeneralNoteResponse)
def create_general_note(data: GeneralNoteCreate, db: Session = Depends(get_db)):
    note = GeneralNote(**data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.put("/general/{id}", response_model=GeneralNoteResponse)
def update_general_note(id: int, data: GeneralNoteUpdate, db: Session = Depends(get_db)):
    note = db.query(GeneralNote).filter(GeneralNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note

@router.delete("/general/{id}")
def delete_general_note(id: int, db: Session = Depends(get_db)):
    note = db.query(GeneralNote).filter(GeneralNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    db.delete(note)
    db.commit()
    return {"message": "删除成功"}

# Note Template CRUD
@router.get("/templates", response_model=List[NoteTemplateResponse])
def list_note_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(NoteTemplate).offset(skip).limit(limit).all()

@router.get("/templates/{id}", response_model=NoteTemplateResponse)
def get_note_template(id: int, db: Session = Depends(get_db)):
    template = db.query(NoteTemplate).filter(NoteTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="笔记模板不存在")
    return template

@router.post("/templates", response_model=NoteTemplateResponse)
def create_note_template(data: NoteTemplateCreate, db: Session = Depends(get_db)):
    template = NoteTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/templates/{id}", response_model=NoteTemplateResponse)
def update_note_template(id: int, data: NoteTemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(NoteTemplate).filter(NoteTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="笔记模板不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    db.commit()
    db.refresh(template)
    return template

@router.delete("/templates/{id}")
def delete_note_template(id: int, db: Session = Depends(get_db)):
    template = db.query(NoteTemplate).filter(NoteTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="笔记模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "删除成功"}
