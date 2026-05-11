"""
同步服务 - 多设备增量同步
"""
from datetime import datetime
from typing import Dict, List, Any, Optional
import json

from sqlalchemy.orm import Session
from models.literature import LiteratureEntry, LiteratureTableEntry
from models.learning import Word, LongSentence, WordList, SentenceList
from models.note import GeneralNote, NoteTemplate
from models.card import LiteratureCard
from models.structured import StructuredLiterature, StructuredNote
from models.organization import Tag, Collection, CollectionItem
from models.translation import TranslationCard


class SyncService:
    """同步服务 - 基于时间戳的增量同步"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_all_tables(self) -> List[str]:
        """获取所有可同步的表"""
        return [
            "literature_entries",
            "literature_table_entries",
            "words",
            "long_sentences",
            "word_lists",
            "sentence_lists",
            "general_notes",
            "note_templates",
            "literature_cards",
            "structured_literature",
            "structured_notes",
            "tags",
            "collections",
            "collection_items",
            "translation_cards",
        ]
    
    def get_table_model(self, table_name: str):
        """获取表对应的模型类"""
        models = {
            "literature_entries": LiteratureEntry,
            "literature_table_entries": LiteratureTableEntry,
            "words": Word,
            "long_sentences": LongSentence,
            "word_lists": WordList,
            "sentence_lists": SentenceList,
            "general_notes": GeneralNote,
            "note_templates": NoteTemplate,
            "literature_cards": LiteratureCard,
            "structured_literature": StructuredLiterature,
            "structured_notes": StructuredNote,
            "tags": Tag,
            "collections": Collection,
            "collection_items": CollectionItem,
            "translation_cards": TranslationCard,
        }
        return models.get(table_name)
    
    def pull_changes(self, last_sync_time: Optional[str]) -> Dict[str, Any]:
        """
        拉取服务端变更
        
        Args:
            last_sync_time: 上次同步时间 (ISO格式)
            
        Returns:
            包含变更数据的字典
        """
        result = {
            "sync_time": datetime.utcnow().isoformat() + "Z",
            "changes": {},
            "deleted": {}
        }
        
        if last_sync_time:
            last_dt = datetime.fromisoformat(last_sync_time.replace("Z", "+00:00"))
        else:
            last_dt = datetime.min
        
        for table_name in self.get_all_tables():
            model = self.get_table_model(table_name)
            if not model:
                continue
            
            # 获取updated_at字段的记录
            try:
                records = self.db.query(model).filter(
                    model.updated_at >= last_dt if hasattr(model, 'updated_at') else True
                ).all()
                
                result["changes"][table_name] = [
                    self._record_to_dict(record) for record in records
                ]
                
                # TODO: 记录删除的记录（需要维护deleted表）
                result["deleted"][table_name] = []
                
            except Exception as e:
                print(f"Error pulling {table_name}: {e}")
                result["changes"][table_name] = []
        
        return result
    
    def push_changes(self, changes: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """
        推送本地变更到服务端
        
        Args:
            changes: 本地变更数据 {table_name: [records]}
            
        Returns:
            处理结果
        """
        result = {
            "success": True,
            "processed": {},
            "errors": []
        }
        
        for table_name, records in changes.items():
            model = self.get_table_model(table_name)
            if not model:
                result["errors"].append(f"Unknown table: {table_name}")
                continue
            
            processed_count = 0
            for record in records:
                try:
                    self._apply_record(model, record)
                    processed_count += 1
                except Exception as e:
                    result["errors"].append(f"Error processing {table_name}: {e}")
            
            result["processed"][table_name] = processed_count
        
        self.db.commit()
        return result
    
    def get_sync_status(self) -> Dict[str, Any]:
        """获取同步状态"""
        status = {
            "last_sync_time": datetime.utcnow().isoformat() + "Z",
            "tables": {}
        }
        
        for table_name in self.get_all_tables():
            model = self.get_table_model(table_name)
            if model:
                try:
                    count = self.db.query(model).count()
                    status["tables"][table_name] = {
                        "count": count,
                        "available": True
                    }
                except:
                    status["tables"][table_name] = {
                        "count": 0,
                        "available": False
                    }
        
        return status
    
    def resolve_conflict(
        self,
        table_name: str,
        record_id: Any,
        resolution: str,  # "local" | "remote"
        local_data: Dict[str, Any] = None,
        remote_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        解决冲突
        
        Args:
            table_name: 表名
            record_id: 记录ID
            resolution: 解决方案 ("local" | "remote")
            local_data: 本地数据
            remote_data: 远程数据
        """
        model = self.get_table_model(table_name)
        if not model:
            return {"success": False, "error": "Unknown table"}
        
        try:
            if resolution == "local" and local_data:
                self._apply_record(model, local_data)
            elif resolution == "remote" and remote_data:
                self._apply_record(model, remote_data)
            
            self.db.commit()
            return {"success": True}
        except Exception as e:
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def _record_to_dict(self, record) -> Dict[str, Any]:
        """将模型记录转换为字典"""
        data = {}
        for column in record.__table__.columns:
            value = getattr(record, column.name)
            if isinstance(value, datetime):
                data[column.name] = value.isoformat()
            else:
                data[column.name] = value
        return data
    
    def _apply_record(self, model, record: Dict[str, Any]):
        """应用记录到数据库"""
        # 确定主键列
        primary_key = None
        for column in model.__table__.columns:
            if column.primary_key:
                primary_key = column.name
                break
        
        if not primary_key:
            return
        
        pk_value = record.get(primary_key)
        
        # 查找现有记录
        existing = self.db.query(model).filter(
            getattr(model, primary_key) == pk_value
        ).first()
        
        if existing:
            # 更新
            for key, value in record.items():
                if key != primary_key:
                    setattr(existing, key, value)
            if hasattr(existing, 'updated_at'):
                existing.updated_at = datetime.utcnow()
        else:
            # 创建
            new_record = model(**record)
            self.db.add(new_record)


def create_sync_service(db: Session) -> SyncService:
    """创建同步服务实例"""
    return SyncService(db)
