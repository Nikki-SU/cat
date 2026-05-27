"""
附件同步服务 - PDF等文件在设备间同步
Phase 3: 附件同步

同步策略：
- Hub存储所有附件的完整文件
- Leaf按需下载：浏览到有附件的文献时才下载
- 同步时只传输附件的元信息（文件名、大小、hash）
- 附件文件通过HTTP直接传输（局域网内）或通过中继（跨网络）
"""
import os
import hashlib
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from models.attachment import LiteratureAttachment
from config import settings


class AttachmentSyncService:
    """附件同步服务"""
    
    def __init__(self, db: Session):
        self.db = db
        self.attachments_dir = settings.ATTACHMENTS_DIR
        os.makedirs(self.attachments_dir, exist_ok=True)
    
    def get_attachment_manifest(self) -> List[Dict]:
        """
        获取附件清单（元信息，不含文件内容）
        Returns: [{"doi": "10.1038/xxx", "filename": "xxx.pdf", "size": 12345, "hash": "sha256:xxx"}, ...]
        """
        attachments = self.db.query(LiteratureAttachment).all()
        manifest = []
        for att in attachments:
            filepath = os.path.join(self.attachments_dir, att.filename) if att.filename else None
            file_hash = None
            file_size = None
            if filepath and os.path.exists(filepath):
                file_size = os.path.getsize(filepath)
                file_hash = self._hash_file(filepath)
            manifest.append({
                "doi": att.doi,
                "filename": att.filename,
                "size": file_size,
                "hash": file_hash,
                "content_type": att.file_type or "application/octet-stream",
                "uploaded_at": att.created_at.isoformat() if att.created_at else None
            })
        return manifest
    
    def get_missing_attachments(self, remote_manifest: List[Dict]) -> List[Dict]:
        """
        对比本地和远程清单，返回本地缺少的附件
        
        Args:
            remote_manifest: 远程附件清单
            
        Returns:
            本地缺少的附件列表
        """
        local_files = {}
        if os.path.exists(self.attachments_dir):
            for root, dirs, files in os.walk(self.attachments_dir):
                for f in files:
                    filepath = os.path.join(root, f)
                    try:
                        local_files[f] = {
                            "size": os.path.getsize(filepath),
                            "hash": self._hash_file(filepath)
                        }
                    except:
                        pass
        
        missing = []
        for remote in remote_manifest:
            local = local_files.get(remote["filename"])
            if not local or local["hash"] != remote.get("hash"):
                missing.append(remote)
        return missing
    
    def get_attachment_stats(self) -> Dict:
        """获取附件统计信息"""
        attachments = self.db.query(LiteratureAttachment).all()
        total_count = len(attachments)
        total_size = 0
        existing_files = 0
        
        for att in attachments:
            if att.filename:
                filepath = os.path.join(self.attachments_dir, att.filename)
                if os.path.exists(filepath):
                    existing_files += 1
                    total_size += os.path.getsize(filepath)
        
        return {
            "total_count": total_count,
            "existing_files": existing_files,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2)
        }
    
    def _hash_file(self, filepath: str) -> str:
        """计算文件SHA256"""
        sha256 = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    sha256.update(chunk)
            return f"sha256:{sha256.hexdigest()}"
        except:
            return None
    
    def get_attachment_by_doi(self, doi: str) -> Optional[LiteratureAttachment]:
        """根据DOI获取附件"""
        return self.db.query(LiteratureAttachment).filter(
            LiteratureAttachment.doi == doi
        ).first()
    
    def get_attachment_filepath(self, doi: str) -> Optional[str]:
        """获取附件的完整文件路径"""
        attachment = self.get_attachment_by_doi(doi)
        if attachment and attachment.filename:
            filepath = os.path.join(self.attachments_dir, attachment.filename)
            if os.path.exists(filepath):
                return filepath
        return None


def get_attachment_sync_service(db: Session) -> AttachmentSyncService:
    """创建附件同步服务实例"""
    return AttachmentSyncService(db)
