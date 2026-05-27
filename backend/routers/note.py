"""笔记相关 API 路由"""
import os
import json
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Path, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.note import GeneralNote, NoteTemplate
from models.literature import LiteratureTableEntry
from schemas.note import (
    GeneralNoteCreate, GeneralNoteUpdate, GeneralNoteResponse,
    NoteTemplateCreate, NoteTemplateUpdate, NoteTemplateResponse
)

router = APIRouter(prefix="/notes", tags=["笔记"])

NOTE_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "note_files")
os.makedirs(NOTE_UPLOAD_DIR, exist_ok=True)


def _sync_has_notes(doi: str, db: Session):
    """同步文献表的has_notes标记"""
    if not doi:
        return
    count = db.query(GeneralNote).filter(GeneralNote.doi == doi).count()
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if entry:
        entry.has_notes = count > 0
        db.commit()


# General Note CRUD
@router.get("/general", response_model=List[GeneralNoteResponse])
def list_general_notes(skip: int = 0, limit: int = 100, doi: str = None, file_type: str = None, db: Session = Depends(get_db)):
    query = db.query(GeneralNote)
    if doi:
        query = query.filter(GeneralNote.doi == doi)
    if file_type:
        query = query.filter(GeneralNote.file_type == file_type)
    return query.order_by(GeneralNote.updated_at.desc()).offset(skip).limit(limit).all()

@router.get("/general/{id}", response_model=GeneralNoteResponse)
def get_general_note(id: int = Path(...), db: Session = Depends(get_db)):
    note = db.query(GeneralNote).filter(GeneralNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note

@router.post("/general", response_model=GeneralNoteResponse)
def create_general_note(data: GeneralNoteCreate, db: Session = Depends(get_db)):
    try:
        # 排除 template_id 防止外键约束报错（如果 note_templates 表不存在）
        note_data = data.model_dump(exclude={"template_id"})
        note = GeneralNote(**note_data)
        db.add(note)
        db.commit()
        db.refresh(note)
        _sync_has_notes(note.doi, db)
        return note
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建笔记失败: {str(e)}")

@router.put("/general/{id}", response_model=GeneralNoteResponse)
def update_general_note(id: int = Path(...), data: GeneralNoteUpdate = Body(...), db: Session = Depends(get_db)):
    note = db.query(GeneralNote).filter(GeneralNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    old_doi = note.doi
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    # If DOI changed, sync both old and new
    if old_doi != note.doi:
        _sync_has_notes(old_doi, db)
    _sync_has_notes(note.doi, db)
    return note

@router.delete("/general/{id}")
def delete_general_note(id: int = Path(...), db: Session = Depends(get_db)):
    note = db.query(GeneralNote).filter(GeneralNote.id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    doi = note.doi
    # Clean up uploaded file if any
    if note.file_path and os.path.exists(note.file_path):
        try:
            os.remove(note.file_path)
        except Exception as e:
            print(f"Warning: {e}")
    db.delete(note)
    db.commit()
    _sync_has_notes(doi, db)
    return {"message": "删除成功"}

@router.post("/upload-file", response_model=GeneralNoteResponse)
async def upload_note_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    doi: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """上传文件创建笔记 - 支持pdf/word/excel等"""
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    # Determine file type
    if ext in ("doc", "docx"):
        file_type = "word"
    elif ext in ("xls", "xlsx"):
        file_type = "excel"
    elif ext == "pdf":
        file_type = "pdf"
    elif ext in ("md", "markdown"):
        file_type = "markdown"
    else:
        file_type = "other"
    
    # Save file
    safe_doi = (doi or "note").replace("/", "_").replace(":", "_")
    safe_name = f"{safe_doi}_{file.filename}"
    file_path = os.path.join(NOTE_UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # For markdown files, read content
    content = None
    file_data = None
    if file_type == "markdown":
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"Warning: {e}")
    
    note = GeneralNote(
        title=title or filename,
        content=content,
        doi=doi,
        file_type=file_type,
        file_data=file_data,
        file_path=file_path
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    _sync_has_notes(doi, db)
    return note


@router.get("/files/{note_id}")
def download_note_file(note_id: int = Path(...), db: Session = Depends(get_db)):
    """下载笔记关联的文件"""
    note = db.query(GeneralNote).filter(GeneralNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    
    if not note.file_path or not os.path.exists(note.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    from fastapi.responses import FileResponse
    filename = note.title or os.path.basename(note.file_path)
    return FileResponse(
        note.file_path,
        filename=filename,
        media_type="application/octet-stream"
    )


# Note Template CRUD
@router.get("/templates", response_model=List[NoteTemplateResponse])
def list_note_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(NoteTemplate).offset(skip).limit(limit).all()

@router.get("/templates/{id}", response_model=NoteTemplateResponse)
def get_note_template(id: int = Path(...), db: Session = Depends(get_db)):
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
def update_note_template(id: int = Path(...), data: NoteTemplateUpdate = Body(...), db: Session = Depends(get_db)):
    template = db.query(NoteTemplate).filter(NoteTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="笔记模板不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    db.commit()
    db.refresh(template)
    return template

@router.delete("/templates/{id}")
def delete_note_template(id: int = Path(...), db: Session = Depends(get_db)):
    template = db.query(NoteTemplate).filter(NoteTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="笔记模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "删除成功"}
