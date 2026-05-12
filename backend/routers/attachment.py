"""附件相关 API 路由"""
import os
import uuid
import asyncio
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from io import BytesIO

from database import get_db
from models.attachment import LiteratureAttachment
from models.literature import LiteratureTableEntry
from models.structured import StructuredLiterature
from schemas.attachment import AttachmentCreate, AttachmentUpdate, AttachmentResponse
from services.mineru_service import get_mineru_service
from config import settings
from routers.settings import get_mineru_config_value

router = APIRouter(prefix="/attachments", tags=["附件"])

# 附件存储目录
ATTACHMENTS_DIR = settings.ATTACHMENTS_DIR
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

# 允许的文件类型
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.epub', '.md', '.markdown', '.ppt', '.pptx', '.xls', '.xlsx'}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB

# 任务状态存储（内存中，生产环境应使用Redis）
_task_status = {}


def ensure_attachments_dir():
    """确保附件目录存在"""
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)


def sanitize_doi(doi: str) -> str:
    """清理DOI作为目录名"""
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


async def save_structured_literature(doi: str, content: str, db: Session):
    """保存结构性文献（内部函数）"""
    existing = db.query(StructuredLiterature).filter(StructuredLiterature.doi == doi).first()
    
    if existing:
        existing.content = content
    else:
        literature = StructuredLiterature(doi=doi, content=content)
        db.add(literature)
    
    db.commit()


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
            pass
    
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

@router.post("/{attachment_id}/parse")
async def parse_attachment(
    attachment_id: int,
    mode: str = Query("auto", description="解析模式: auto/pipeline/vlm"),
    db: Session = Depends(get_db)
):
    """
    解析附件为结构性文献
    
    使用MinerU解析PDF/DOC等文件，提取Markdown内容，
    保存为结构性文献。
    
    Args:
        attachment_id: 附件ID
        mode: 解析模式
            - auto: 自动选择（有Token用Precision，否则用Agent）
            - pipeline: 强制使用Precision Pipeline模型
            - vlm: 强制使用Precision VLM模型（推荐）
            - agent: 强制使用Agent轻量API（免Token）
    """
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    if not attachment.file_path or not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查文件类型
    supported_types = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg']
    if attachment.file_type.lower() not in supported_types:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {attachment.file_type}")
    
    # 生成任务ID
    task_id = str(uuid.uuid4())
    
    # 获取配置
    api_token = get_mineru_config_value("api_token")
    model_version = get_mineru_config_value("model_version", "vlm")
    language = get_mineru_config_value("language", "en")
    
    # 存储任务状态
    _task_status[task_id] = {
        "status": "pending",
        "attachment_id": attachment_id,
        "doi": attachment.doi,
        "progress": 0,
        "message": "准备解析..."
    }
    
    # 后台执行解析
    asyncio.create_task(_parse_attachment_task(
        task_id, attachment, api_token, model_version, language, db
    ))
    
    return {
        "success": True,
        "task_id": task_id,
        "message": "解析任务已提交"
    }


@router.post("/{attachment_id}/parse-and-extract")
async def parse_and_extract_attachment(
    attachment_id: int,
    max_sentences: int = Query(10, description="最大提取句子数"),
    max_words: int = Query(20, description="最大提取单词数"),
    db: Session = Depends(get_db)
):
    """
    解析+AI提取
    
    先解析为markdown，再调用AI提取长难句和单词，
    全部自动挂载到DOI下。
    """
    attachment = db.query(LiteratureAttachment).filter(
        LiteratureAttachment.id == attachment_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    
    if not attachment.file_path or not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 生成任务ID
    task_id = str(uuid.uuid4())
    
    # 获取配置
    api_token = get_mineru_config_value("api_token")
    
    # 存储任务状态
    _task_status[task_id] = {
        "status": "pending",
        "attachment_id": attachment_id,
        "doi": attachment.doi,
        "progress": 0,
        "message": "准备解析..."
    }
    
    # 后台执行解析+提取
    asyncio.create_task(_parse_and_extract_task(
        task_id, attachment, api_token, max_sentences, max_words, db
    ))
    
    return {
        "success": True,
        "task_id": task_id,
        "message": "解析+提取任务已提交"
    }


@router.get("/parse-status/{task_id}")
def get_parse_status(task_id: str):
    """
    查询解析进度
    
    支持前端轮询
    """
    if task_id not in _task_status:
        return {
            "status": "not_found",
            "message": "任务不存在或已过期"
        }
    
    return _task_status[task_id]


async def _parse_attachment_task(
    task_id: str,
    attachment: LiteratureAttachment,
    api_token: str,
    model_version: str,
    language: str,
    db: Session
):
    """后台解析任务"""
    try:
        _task_status[task_id]["status"] = "running"
        _task_status[task_id]["progress"] = 10
        _task_status[task_id]["message"] = "正在连接MinerU服务..."
        
        # 获取MinerU服务
        mineru = get_mineru_service(api_token)
        
        _task_status[task_id]["progress"] = 20
        _task_status[task_id]["message"] = "正在解析文档..."
        
        # 执行解析
        result = await mineru.extract(
            attachment.file_path,
            source_type="file",
            model_version=model_version,
            language=language
        )
        
        _task_status[task_id]["progress"] = 80
        _task_status[task_id]["message"] = "正在保存结果..."
        
        if result.get("success"):
            markdown = result.get("markdown", "")
            
            # 保存为结构性文献
            await save_structured_literature(
                doi=attachment.doi,
                content=markdown,
                db=db
            )
            
            # 更新文献关联状态
            entry = db.query(LiteratureTableEntry).filter(
                LiteratureTableEntry.doi == attachment.doi
            ).first()
            if entry:
                entry.has_structured = True
                db.commit()
            
            _task_status[task_id]["status"] = "done"
            _task_status[task_id]["progress"] = 100
            _task_status[task_id]["message"] = "解析完成"
            _task_status[task_id]["markdown_length"] = len(markdown)
        else:
            _task_status[task_id]["status"] = "failed"
            _task_status[task_id]["message"] = result.get("error", "解析失败")
            
    except Exception as e:
        _task_status[task_id]["status"] = "failed"
        _task_status[task_id]["message"] = f"解析出错: {str(e)}"
    finally:
        # 5分钟后清理状态
        asyncio.get_event_loop().call_later(300, lambda: _task_status.pop(task_id, None))


async def _parse_and_extract_task(
    task_id: str,
    attachment: LiteratureAttachment,
    api_token: str,
    max_sentences: int,
    max_words: int,
    db: Session
):
    """后台解析+AI提取任务"""
    try:
        _task_status[task_id]["status"] = "running"
        _task_status[task_id]["progress"] = 5
        _task_status[task_id]["message"] = "准备解析文档..."
        
        # 1. 解析文档
        mineru = get_mineru_service(api_token)
        model_version = get_mineru_config_value("model_version", "vlm")
        language = get_mineru_config_value("language", "en")
        
        _task_status[task_id]["progress"] = 10
        _task_status[task_id]["message"] = "正在解析文档..."
        
        result = await mineru.extract(
            attachment.file_path,
            source_type="file",
            model_version=model_version,
            language=language
        )
        
        if not result.get("success"):
            _task_status[task_id]["status"] = "failed"
            _task_status[task_id]["message"] = result.get("error", "解析失败")
            return
        
        markdown = result.get("markdown", "")
        
        _task_status[task_id]["progress"] = 40
        _task_status[task_id]["message"] = "正在保存内容..."
        
        # 2. 保存为结构性文献
        await save_structured_literature(
            doi=attachment.doi,
            content=markdown,
            db=db
        )
        
        # 更新文献关联状态
        entry = db.query(LiteratureTableEntry).filter(
            LiteratureTableEntry.doi == attachment.doi
        ).first()
        if entry:
            entry.has_structured = True
            db.commit()
        
        _task_status[task_id]["progress"] = 50
        _task_status[task_id]["message"] = "正在提取长难句..."
        
        # 3. 提取长难句
        from services.ai_service import get_ai_service
        
        ai_service = get_ai_service()
        
        if ai_service and markdown:
            # 分割句子
            sentences = _split_sentences(markdown)
            
            # 筛选长难句（超过20词的英文句子）
            long_sentences = [s for s in sentences if len(s.split()) > 20]
            selected = long_sentences[:max_sentences]
            
            _task_status[task_id]["progress"] = 60
            _task_status[task_id]["message"] = f"正在处理 {len(selected)} 个长难句..."
            
            # 保存长难句
            from models.learning import LongSentence
            
            for i, sentence in enumerate(selected):
                # 翻译
                translation = ""
                try:
                    trans_result = await ai_service.translate(sentence)
                    if trans_result.get("success"):
                        translation = trans_result.get("translation", "")
                except:
                    pass
                
                sentence_entry = LongSentence(
                    doi=attachment.doi,
                    sentence_en=sentence,
                    sentence_cn=translation
                )
                db.add(sentence_entry)
                
                # 更新进度
                progress = 60 + int(20 * (i + 1) / len(selected))
                _task_status[task_id]["progress"] = progress
            
            db.commit()
        
        _task_status[task_id]["progress"] = 80
        _task_status[task_id]["message"] = "正在提取单词..."
        
        # 4. 提取单词（简化版本：从长句中提取）
        if ai_service and markdown:
            from models.learning import Word
            import re
            
            # 简单提取：找到看起来像单词的词（首字母大写后的词）
            words = re.findall(r'\b[A-Z][a-z]{5,}\b', markdown)
            words = list(set(words))[:max_words]
            
            for word in words:
                word_entry = Word(
                    doi=attachment.doi,
                    word_en=word,
                    status="new"
                )
                db.add(word_entry)
            
            db.commit()
        
        _task_status[task_id]["status"] = "done"
        _task_status[task_id]["progress"] = 100
        _task_status[task_id]["message"] = "解析和提取完成"
        
    except Exception as e:
        _task_status[task_id]["status"] = "failed"
        _task_status[task_id]["message"] = f"处理出错: {str(e)}"
    finally:
        # 5分钟后清理状态
        asyncio.get_event_loop().call_later(300, lambda: _task_status.pop(task_id, None))


def _split_sentences(text: str) -> List[str]:
    """简单分句"""
    import re
    # 按句号、问号、感叹号分句
    sentences = re.split(r'[.!?]+', text)
    # 清理并过滤
    result = []
    for s in sentences:
        s = s.strip()
        if len(s) > 10:  # 过滤太短的
            result.append(s)
    return result


# ==================== 批量解析 ====================

@router.post("/batch-parse")
async def batch_parse_attachments(
    attachment_ids: List[int] = Query(..., description="附件ID列表"),
    mode: str = Query("auto", description="解析模式"),
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
        
        # 提交异步任务
        task_id = str(uuid.uuid4())
        
        api_token = get_mineru_config_value("api_token")
        model_version = get_mineru_config_value("model_version", "vlm")
        language = get_mineru_config_value("language", "en")
        
        _task_status[task_id] = {
            "status": "pending",
            "attachment_id": attachment_id,
            "doi": attachment.doi,
            "progress": 0,
            "message": "准备解析..."
        }
        
        asyncio.create_task(_parse_attachment_task(
            task_id, attachment, api_token, model_version, language, db
        ))
        
        results.append({
            "id": attachment_id,
            "success": True,
            "task_id": task_id
        })
    
    return {"results": results}


# ==================== 上传并解析 ====================

@router.post("/upload-with-parse")
async def upload_and_parse(
    doi: str = Form(...),
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    db: Session = Depends(get_db)
):
    """
    上传附件并自动解析
    
    Args:
        doi: 文献DOI
        file: 上传的文件
        mode: 解析模式
    """
    ensure_attachments_dir()
    
    # 验证文件
    is_valid, error_msg, ext = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_dir = get_attachment_dir(doi)
    file_path = os.path.join(file_dir, unique_filename)
    
    # 保存文件
    content = await file.read()
    file_size = len(content)
    
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
    
    entry = db.query(LiteratureTableEntry).filter(LiteratureTableEntry.doi == doi).first()
    if entry:
        entry.has_attachment = True
    
    db.commit()
    db.refresh(attachment)
    
    return {
        "success": True,
        "attachment_id": attachment.id,
        "filename": attachment.filename,
        "message": "上传成功"
    }
