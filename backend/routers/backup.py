"""备份与同步相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Path
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import shutil
import zipfile
import json

from database import get_db, DATA_DIR, ATTACHMENTS_DIR
from services.sync_service import SyncService, create_sync_service
from config import settings

router = APIRouter(prefix="/backup", tags=["备份同步"])

BACKUP_DIR = os.path.join(DATA_DIR, "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

# ==================== 备份 ====================

@router.post("/create")
def create_backup(background_tasks: BackgroundTasks):
    """创建完整备份（SQLite + attachments打包为zip）"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"cat_backup_{timestamp}.zip"
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    
    try:
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 备份数据库
            db_path = os.path.join(DATA_DIR, "cat.db")
            if os.path.exists(db_path):
                zf.write(db_path, "cat.db")
            
            # 备份附件目录
            if os.path.exists(ATTACHMENTS_DIR):
                for root, dirs, files in os.walk(ATTACHMENTS_DIR):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, DATA_DIR)
                        zf.write(file_path, arcname)
            
            # 备份配置
            config_path = os.path.join(DATA_DIR, "config.json")
            if os.path.exists(config_path):
                zf.write(config_path, "config.json")
        
        return {
            "success": True,
            "backup_name": backup_name,
            "size": os.path.getsize(backup_path),
            "created_at": timestamp
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"备份失败: {str(e)}")


@router.get("/list")
def list_backups():
    """列出备份文件"""
    backups = []
    if os.path.exists(BACKUP_DIR):
        for f in os.listdir(BACKUP_DIR):
            if f.endswith('.zip'):
                path = os.path.join(BACKUP_DIR, f)
                backups.append({
                    "name": f,
                    "size": os.path.getsize(path),
                    "created_at": datetime.fromtimestamp(os.path.getctime(path)).isoformat()
                })
    return sorted(backups, key=lambda x: x["created_at"], reverse=True)


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """从zip恢复数据"""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="只支持.zip格式的备份文件")
    
    temp_path = os.path.join(BACKUP_DIR, f"temp_restore_{datetime.now().timestamp()}.zip")
    
    try:
        content = await file.read()
        with open(temp_path, 'wb') as f:
            f.write(content)
        
        extract_dir = os.path.join(BACKUP_DIR, f"extract_{datetime.now().timestamp()}")
        with zipfile.ZipFile(temp_path, 'r') as zf:
            zf.extractall(extract_dir)
        
        # 恢复数据库
        backup_db = os.path.join(extract_dir, "cat.db")
        if os.path.exists(backup_db):
            db_path = os.path.join(DATA_DIR, "cat.db")
            shutil.copy2(backup_db, db_path)
        
        # 恢复附件
        backup_attachments = os.path.join(extract_dir, "attachments")
        if os.path.exists(backup_attachments):
            if os.path.exists(ATTACHMENTS_DIR):
                shutil.rmtree(ATTACHMENTS_DIR)
            shutil.copytree(backup_attachments, ATTACHMENTS_DIR)
        
        # 恢复配置
        backup_config = os.path.join(extract_dir, "config.json")
        if os.path.exists(backup_config):
            config_path = os.path.join(DATA_DIR, "config.json")
            shutil.copy2(backup_config, config_path)
        
        shutil.rmtree(extract_dir, ignore_errors=True)
        
        return {
            "success": True,
            "message": "恢复成功，请重启服务以加载新数据"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"恢复失败: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.get("/download/{filename}")
def download_backup(filename: str = Path(...)):
    """下载备份文件"""
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="无效的文件名")
    
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="备份文件不存在")
    
    return FileResponse(backup_path, filename=filename, media_type='application/zip')


# ==================== 同步 ====================

sync_router = APIRouter(prefix="/sync", tags=["同步"])


# @sync_router.post("/push")
def push_changes(changes: dict, db: Session = Depends(get_db)):
    """客户端推送本地变更"""
    sync_service = create_sync_service(db)
    result = sync_service.push_changes(changes.get("changes", {}))
    return result


# @sync_router.post("/pull")
def pull_changes(last_sync_time: Optional[str] = None, db: Session = Depends(get_db)):
    """客户端拉取服务端变更"""
    sync_service = create_sync_service(db)
    return sync_service.pull_changes(last_sync_time)


# @sync_router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    """获取同步状态"""
    sync_service = create_sync_service(db)
    return sync_service.get_sync_status()


# @sync_router.post("/resolve-conflict")
def resolve_conflict(
    table_name: str,
    record_id: str,
    resolution: str,
    local_data: Optional[dict] = None,
    remote_data: Optional[dict] = None,
    db: Session = Depends(get_db)
):
    """解决同步冲突"""
    sync_service = create_sync_service(db)
    return sync_service.resolve_conflict(table_name, record_id, resolution, local_data, remote_data)
