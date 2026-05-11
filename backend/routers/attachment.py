"""附件相关 API 路由"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.attachment import LiteratureAttachment
from schemas.attachment import AttachmentCreate, AttachmentUpdate, AttachmentResponse
from config import settings

router = APIRouter(prefix="/attachments", tags=["附件"])

ATTACHMENTS_DIR = getattr(settings, 'ATTACHMENTS_DIR', './data/attachments')

def ensure_attachments_dir():
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

@router.get("", response_model=List[AttachmentResponse])
def list_attachments(skip: int = 0, limit: int = 100, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(LiteratureAttachment)
    if doi:
        query = query.filter(LiteratureAttachment.doi == doi)
    return query.offset(skip).limit(limit).all()

@router.get("/{id}", response_model=AttachmentResponse)
def get_attachment(id: int, db: Session = Depends(get_db)):
    attachment = db.query(LiteratureAttachment).filter(LiteratureAttachment.id == id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    return attachment

@router.post("", response_model=AttachmentResponse)
async def create_attachment(
    doi: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    ensure_attachments_dir()
    # 生成唯一文件名
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(ATTACHMENTS_DIR, unique_filename)
    
    # 保存文件
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # 创建数据库记录
    attachment = LiteratureAttachment(
        doi=doi,
        filename=file.filename,
        file_type=ext.lstrip("."),
        file_path=file_path,
        file_size=len(content)
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment

@router.put("/{id}", response_model=AttachmentResponse)
def update_attachment(id: int, data: AttachmentUpdate, db: Session = Depends(get_db)):
    attachment = db.query(LiteratureAttachment).filter(LiteratureAttachment.id == id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(attachment, key, value)
    db.commit()
    db.refresh(attachment)
    return attachment

@router.delete("/{id}")
def delete_attachment(id: int, db: Session = Depends(get_db)):
    attachment = db.query(LiteratureAttachment).filter(LiteratureAttachment.id == id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    # 删除文件
    if attachment.file_path and os.path.exists(attachment.file_path):
        os.remove(attachment.file_path)
    db.delete(attachment)
    db.commit()
    return {"message": "删除成功"}

@router.get("/{id}/download")
def download_attachment(id: int, db: Session = Depends(get_db)):
    attachment = db.query(LiteratureAttachment).filter(LiteratureAttachment.id == id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    if not attachment.file_path or not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(attachment.file_path, filename=attachment.filename)
