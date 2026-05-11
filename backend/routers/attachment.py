"""附件相关 API 路由"""
import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from io import BytesIO

from database import get_db
from models.attachment import LiteratureAttachment
from models.literature import LiteratureTableEntry
from schemas.attachment import AttachmentCreate, AttachmentUpdate, AttachmentResponse
from services.mineru_service import get_mineru_service, MinerUService
from config import settings

router = APIRouter(prefix="/attachments", tags=["附件"])

# 附件存储目录
ATTACHMENTS_DIR = settings.ATTACHMENTS_DIR
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

# 允许的文件类型
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.epub', '.md', '.markdown'}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB


def ensure_attachments_dir():
    """确保附件目录存在"""
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)


def sanitize_doi(doi: str) -> str:
    """清理DOI作为目录名"""
    # DOI中的/替换为_以作为目录名
    return doi.replace("/", "_").replace(":", "_")


def get_attachment_dir(doi: str) -> str:
    """获取DOI对应的附件目录"""
    sanitized = sanitize_doi(doi)
    dir_path = os.path.join(ATTACHMENTS_DIR, sanitized)
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


def validate_file(file: UploadFile) -> tuple:
    """验证文件，返回 (is_valid, error_message, extension)"""
    if not file.filename:
        return False, "文件名不能为空", None
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"不支持的文件类型: {ext}，支持的类型: {', '.join(ALLOWED_EXTENSIONS)}", None
    
    return True, None, ext


# ==================== 附件 CRUD ====================

@router.get("", response_model=List[AttachmentResponse])
def list_attachments(
    skip: int = 0, 
    limit: int = 100, 
    doi: str = None, 
    db: Session = Depends(get_db)
):
    """获取附件列表"""
    query = db.query(LiteratureAttachment)
    if doi:
        query = query.filter(LiteratureAttachment.doi == doi)
    return query.offset(skip).limit(limit).all()


@router.get("/by-doi/{doi}", response_model=List[AttachmentResponse])
def get_attachments_by_doi(doi: str, db: Session = Depends(get_db)):
    """获取指定DOI的所有附件"""
    attachments = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.doi == doi
    ).all()
    
    # 更新关联状态
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if entry and attachments:
        entry.has_attachment = True
        db.commit()
    
    return attachments


@router.get("/{attachment_id}", response_model=AttachmentResponse)
def get_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """获取单个附件"""
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    return attachment


@router.post("", response_model=AttachmentResponse)
async def create_attachment(
    doi: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传附件
    
    Args:
        doi: 文献DOI
        file: 上传的文件
    """
    ensure_attachments_dir()
    
    # 