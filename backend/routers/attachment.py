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
    
    # 验证文件
    is_valid, error_msg, ext = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # 生成唯一文件名，保持原扩展名
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_dir = get_attachment_dir(doi)
    file_path = os.path.join(file_dir, unique_filename)
    
    # 保存文件
    content = await file.read()
    file_size = len(content)
    
    # 检查文件大小
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"文件大小超过限制: {MAX_FILE_SIZE / 1024 / 1024}MB")
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # 创建数据库记录
    attachment = LiteratureAttachment(
        doi=doi,
        filename=file.filename,
        file_type=ext.lstrip("."),
        file_path=file_path,
        file_size=file_size
    )
    db.add(attachment)
    
    # 更新文献关联状态
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if entry:
        entry.has_attachment = True
    
    db.commit()
    db.refresh(attachment)
    return attachment


@router.put("/{attachment_id}", response_model=AttachmentResponse)
def update_attachment(
    attachment_id: int, 
    data: AttachmentUpdate, 
    db: Session = Depends(get_db)
):
    """更新附件信息"""
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(attachment, key, value)
    
    db.commit()
    db.refresh(attachment)
    return attachment


@router.delete("/{attachment_id}")
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """删除附件"""
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    # 删除物理文件
    if attachment.file_path and os.path.exists(attachment.file_path):
        try:
            os.remove(attachment.file_path)
        except OSError:
            pass  # 文件可能已被删除
    
    # 更新文献关联状态
    doi = attachment.doi
    db.delete(attachment)
    db.commit()
    
    # 检查是否还有其他附件
    remaining = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.doi == doi
    ).count()
    if remaining == 0:
        entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
        if entry:
            entry.has_attachment = False
            db.commit()
    
    return {"message": "删除成功"}


# ==================== 附件下载 ====================

@router.get("/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_db)):
    """下载附件"""
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    if not attachment.file_path or not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        attachment.file_path, 
        filename=attachment.filename,
        media_type='application/octet-stream'
    )


# ==================== MinerU 解析接口 ====================

@router.post("/parse-pdf")
async def parse_pdf_attachment(
    attachment_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """
    使用 MinerU 解析 PDF 附件
    
    Args:
        attachment_id: 附件ID
    """
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    if not attachment.file_path or not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if attachment.file_type.lower() not in ['pdf', 'doc', 'docx']:
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    
    try:
        mineru_service = await get_mineru_service()
        result = await mineru_service.parse_document(attachment.file_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")


@router.post("/batch-parse")
async def batch_parse_attachments(
    attachment_ids: List[int] = Form(...),
    db: Session = Depends(get_db)
):
    """
    批量解析多个附件
    
    Args:
        attachment_ids: 附件ID列表
    """
    results = []
    for attachment_id in attachment_ids:
        attachment = db.query(LiteratureAttachment).filter(
            LiteratureAttachment.id == attachment_id
        ).first()
        
        if not attachment:
            results.append({
                "id": attachment_id,
                "success": False,
                "error": "附件不存在"
            })
            continue
        
        if not attachment.file_path or not os.path.exists(attachment.file_path):
            results.append({
                "id": attachment_id,
                "success": False,
                "error": "文件不存在"
            })
            continue
        
        try:
            mineru_service = await get_mineru_service()
            parse_result = await mineru_service.parse_document(attachment.file_path)
            results.append({
                "id": attachment_id,
                "success": True,
                "result": parse_result
            })
        except Exception as e:
            results.append({
                "id": attachment_id,
                "success": False,
                "error": str(e)
            })
    
    return {"results": results}
