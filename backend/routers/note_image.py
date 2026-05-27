"""笔记图片上传 API 路由"""
import os
import uuid
import aiofiles
from fastapi import APIRouter, HTTPException, UploadFile, File, Path
from typing import List
from config import settings

router = APIRouter(prefix="/notes", tags=["笔记图片"])

# 笔记图片存储目录
NOTE_IMAGES_DIR = os.path.join(
    os.getenv("CAT_DATA_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"),
    "note_images"
)
os.makedirs(NOTE_IMAGES_DIR, exist_ok=True)

# 允许的图片类型
ALLOWED_IMAGE_TYPES = {
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/bmp', 'image/avif'
}
ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload-image")
async def upload_note_image(file: UploadFile = File(...)):
    """
    上传笔记图片
    
    将图片保存到 note_images 目录，返回可访问的 URL。
    支持粘贴截图、拖拽上传等场景。
    """
    # 验证文件名
    if not file.filename:
        # 粘贴截图时可能没有文件名，生成一个
        ext = '.png'
    else:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的图片类型: {ext}，支持: {', '.join(ALLOWED_EXTENSIONS)}"
            )
    
    # 读取内容并检查大小
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"图片大小超过限制: {MAX_IMAGE_SIZE / 1024 / 1024}MB"
        )
    
    # 验证 Content-Type（如果有）
    if file.content_type and file.content_type not in ALLOWED_IMAGE_TYPES:
        # 有些浏览器粘贴时 content_type 可能为空或 application/octet-stream，放行
        if file.content_type != 'application/octet-stream':
            raise HTTPException(
                status_code=400,
                detail=f"不支持的图片格式: {file.content_type}"
            )
    
    # 生成唯一文件名
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(NOTE_IMAGES_DIR, unique_name)
    
    # 保存文件
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # 返回可访问的 URL
    return {
        "success": True,
        "url": f"/note-images/{unique_name}",
        "filename": file.filename or f"paste{ext}",
        "size": len(content)
    }


@router.post("/upload-image-batch")
async def upload_note_images_batch(files: List[UploadFile] = File(...)):
    """
    批量上传笔记图片
    """
    results = []
    for file in files:
        try:
            result = await upload_note_image(file=file)
            results.append(result)
        except HTTPException as e:
            results.append({
                "success": False,
                "filename": file.filename,
                "error": e.detail
            })
    return {"results": results}


@router.delete("/images/{filename}")
async def delete_note_image(filename: str = Path(...)):
    """
    删除笔记图片
    
    仅删除文件系统中的图片文件，不清理 Markdown 中的引用。
    """
    # 安全检查：防止路径遍历
    if '..' in filename or '/' in filename or '\\' in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    
    file_path = os.path.join(NOTE_IMAGES_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="图片不存在")
    
    os.remove(file_path)
    return {"success": True, "message": "图片已删除"}


@router.get("/images")
async def list_note_images(skip: int = 0, limit: int = 100):
    """
    列出笔记图片
    """
    if not os.path.exists(NOTE_IMAGES_DIR):
        return {"images": [], "total": 0}
    
    files = []
    for f in sorted(os.listdir(NOTE_IMAGES_DIR), key=lambda x: os.path.getmtime(os.path.join(NOTE_IMAGES_DIR, x)), reverse=True):
        fpath = os.path.join(NOTE_IMAGES_DIR, f)
        if os.path.isfile(fpath):
            ext = os.path.splitext(f)[1].lower()
            if ext in ALLOWED_EXTENSIONS:
                files.append({
                    "filename": f,
                    "url": f"/note-images/{f}",
                    "size": os.path.getsize(fpath),
                    "modified": os.path.getmtime(fpath)
                })
    
    total = len(files)
    images = files[skip:skip + limit]
    return {"images": images, "total": total}
