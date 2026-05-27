"""
同步引擎核心 - Hub/Leaf去中心化同步
Phase 3: 离线模式 + 冲突检测与解决
"""
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models.sync import Device, SyncLog, SyncState
from models.literature import LiteratureEntry, LiteratureTableEntry
from models.learning import Word, LongSentence, WordList, SentenceList, TranslationCard
from models.note import GeneralNote, NoteTemplate
from models.card import LiteratureCard
from models.structured import StructuredLiterature, StructuredNote
from models.organization import Tag, Collection, CollectionItem
from services.change_tracker import SyncIgnoreContext, set_current_device_id


# 表名到模型的映射
TABLE_MODELS = {
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

# 表名中文映射
TABLE_NAME_LABELS = {
    "literature_entries": "文献条目",
    "literature_table_entries": "文献",
    "words": "单词",
    "long_sentences": "长难句",
    "word_lists": "单词表",
    "sentence_lists": "句子表",
    "general_notes": "笔记",
    "note_templates": "笔记模板",
    "literature_cards": "文献卡片",
    "structured_literature": "结构化文献",
    "structured_notes": "结构化笔记",
    "tags": "标签",
    "collections": "合集",
    "collection_items": "合集项",
    "translation_cards": "翻译卡片",
}


class SyncEngine:
    """同步引擎 - 处理Hub和Leaf之间的数据同步"""
    
    def __init__(self, db: Session, device_id: str):
        self.db = db
        self.device_id = device_id
    
    def track_change(
        self,
        table_name: str,
        operation: str,
        record_pk: str,
        record_data: Optional[str] = None
    ) -> SyncLog:
        """
        记录变更日志（通常由change_tracker自动调用）
        """
        log_entry = SyncLog(
            device_id=self.device_id,
            table_name=table_name,
            operation=operation,
            record_pk=record_pk,
            record_data=record_data,
            synced=False
        )
        self.db.add(log_entry)
        self.db.commit()
        return log_entry
    
    # ==================== Phase 3: 离线模式 + 冲突检测 ====================
    
    def get_unsynced_changes(self, device_id: str) -> list:
        """获取设备未同步的变更"""
        unsynced = self.db.query(SyncLog).filter(
            SyncLog.synced == False,
            SyncLog.device_id == device_id
        ).order_by(SyncLog.id).all()
        return unsynced
    
    def mark_as_synced(self, log_ids: list):
        """标记变更为已同步"""
        self.db.query(SyncLog).filter(SyncLog.id.in_(log_ids)).update(
            {"synced": True}, synchronize_session=False
        )
        self.db.commit()
    
    def get_local_changes_since(self, since_log_id: int) -> list:
        """获取指定log_id之后的所有本地变更（Hub和Leaf都用）"""
        changes = self.db.query(SyncLog).filter(
            SyncLog.id > since_log_id
        ).order_by(SyncLog.id).all()
        return changes
    
    def check_conflicts(self, incoming_changes: list) -> list:
        """
        检测冲突：同一条记录被不同设备修改
        
        Args:
            incoming_changes: 从远程拉取的变更列表
            
        Returns:
            冲突列表，每个冲突包含incoming、local和local_record
        """
        conflicts = []
        for change in incoming_changes:
            # 查找本地对同一条记录的未同步修改
            local_changes = self.db.query(SyncLog).filter(
                SyncLog.table_name == change["table_name"],
                SyncLog.record_pk == change["record_pk"],
                SyncLog.device_id != change["device_id"],
                SyncLog.operation != "DELETE"
            ).all()
            if local_changes:
                conflicts.append({
                    "incoming": change,
                    "local": self._record_to_dict(local_changes[-1]),
                    "local_record": self._get_current_record(change["table_name"], change["record_pk"])
                })
        return conflicts
    
    def get_conflict_records(self) -> list:
        """
        获取当前所有冲突记录（同一记录被多个设备修改）
        用于前端冲突解决UI
        
        Returns:
            冲突列表
        """
        conflicts = self.db.query(SyncLog).filter(
            SyncLog.synced == False
        ).all()
        
        # 检测重复主键
        conflict_map = {}
        for log in conflicts:
            key = f"{log.table_name}:{log.record_pk}"
            if key not in conflict_map:
                conflict_map[key] = []
            conflict_map[key].append(log)
        
        # 只返回有多个设备修改同一记录的冲突
        result = []
        for key, logs in conflict_map.items():
            device_ids = set(l.device_id for l in logs)
            if len(device_ids) > 1:
                table_name, record_pk = key.split(":")
                current = self._get_current_record(table_name, record_pk)
                result.append({
                    "table_name": table_name,
                    "table_label": TABLE_NAME_LABELS.get(table_name, table_name),
                    "record_pk": record_pk,
                    "current_data": current,
                    "conflicting_changes": [self._record_to_dict(l) for l in logs],
                    "devices": list(device_ids),
                    "conflict_count": len(logs)
                })
        return result
    
    def resolve_conflict(self, table_name: str, record_pk: str, resolution: str, chosen_data: dict = None):
        """
        解决冲突
        
        Args:
            table_name: 表名
            record_pk: 主键值
            resolution: "local" | "remote" | "merge"
            chosen_data: merge时用户选择的数据
        """
        if resolution == "remote":
            if chosen_data:
                self._apply_single_change(table_name, "UPDATE", record_pk, chosen_data)
        elif resolution == "local":
            # 保持本地数据，不做变更
            pass
        elif resolution == "merge" and chosen_data:
            self._apply_single_change(table_name, "UPDATE", record_pk, chosen_data)
        
        # 标记相关冲突日志为已处理
        self.db.query(SyncLog).filter(
            SyncLog.table_name == table_name,
            SyncLog.record_pk == record_pk,
            SyncLog.synced == False
        ).update({"synced": True}, synchronize_session=False)
        self.db.commit()
    
    def _apply_single_change(self, table_name: str, operation: str, record_pk: str, record_data: dict) -> bool:
        """应用单条变更（用于解决冲突）"""
        model = TABLE_MODELS.get(table_name)
        if not model:
            return False
        
        pk_columns = [col for col in model.__table__.columns if col.primary_key]
        if not pk_columns:
            return False
        
        try:
            if len(pk_columns) == 1:
                pk_value = record_pk
                pk_filter = (getattr(model, pk_columns[0].name) == pk_value)
            else:
                pk_dict = json.loads(record_pk)
                pk_filter = and_(*[
                    getattr(model, col.name) == pk_dict.get(col.name)
                    for col in pk_columns
                ])
        except (json.JSONDecodeError, KeyError):
            return False
        
        with SyncIgnoreContext(self.device_id):
            if operation == "UPDATE":
                existing = self.db.query(model).filter(pk_filter).first()
                if existing:
                    for key, value in record_data.items():
                        if key != 'id' and hasattr(existing, key):
                            setattr(existing, key, value)
                    if hasattr(existing, 'updated_at'):
                        existing.updated_at = datetime.utcnow()
                    self.db.commit()
                    return True
            elif operation == "INSERT":
                if 'id' in record_data:
                    del record_data['id']
                new_record = model(**record_data)
                self.db.add(new_record)
                self.db.commit()
                return True
        
        return False
    
    def _get_current_record(self, table_name: str, record_pk: str) -> dict:
        """获取当前记录的完整数据"""
        model = TABLE_MODELS.get(table_name)
        if not model:
            return None
        pk_column = [col for col in model.__table__.columns if col.primary_key]
        if not pk_column:
            return None
        
        try:
            if len(pk_column) == 1:
                pk_value = record_pk
                pk_filter = (getattr(model, pk_column[0].name) == pk_value)
            else:
                pk_dict = json.loads(record_pk)
                pk_filter = and_(*[
                    getattr(model, col.name) == pk_dict.get(col.name)
                    for col in pk_column
                ])
            record = self.db.query(model).filter(pk_filter).first()
            if record:
                return self._record_to_dict(record)
        except (json.JSONDecodeError, KeyError, AttributeError):
            print(f"Warning: {e}")
        return None
    
    def _record_to_dict(self, record) -> dict:
        """将模型记录转换为字典"""
        if hasattr(record, '__table__'):
            result = {}
            for col in record.__table__.columns:
                value = getattr(record, col.name)
                if isinstance(value, datetime):
                    result[col.name] = value.isoformat()
                else:
                    result[col.name] = value
            return result
        elif isinstance(record, dict):
            return record
        return {}
    
    def push_changes(self, changes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Leaf向Hub推送变更
        Hub应用变更到主数据库，记录到Hub的sync_log
        
        Args:
            changes: 变更列表
            
        Returns:
            处理结果
        """
        result = {
            "success": True,
            "processed": 0,
            "errors": []
        }
        
        for change in changes:
            try:
                self._apply_change(change, is_remote=True)
                result["processed"] += 1
            except Exception as e:
                result["errors"].append({
                    "table": change.get("table_name"),
                    "pk": change.get("record_pk"),
                    "error": str(e)
                })
                result["success"] = False
        
        self.db.commit()
        return result
    
    def pull_changes(self, since_log_id: int = 0) -> Dict[str, Any]:
        """
        Leaf从Hub拉取变更
        
        Args:
            since_log_id: 从哪个日志ID之后开始拉取
            
        Returns:
            变更列表和最新日志ID
        """
        # 获取since_log_id之后的所有日志
        logs = self.db.query(SyncLog).filter(
            SyncLog.id > since_log_id
        ).order_by(SyncLog.id.asc()).limit(1000).all()
        
        changes = []
        for log in logs:
            changes.append({
                "id": log.id,
                "device_id": log.device_id,
                "table_name": log.table_name,
                "operation": log.operation,
                "record_pk": log.record_pk,
                "record_data": log.record_data,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None
            })
        
        # 获取最新的日志ID
        latest_log = self.db.query(SyncLog).order_by(SyncLog.id.desc()).first()
        latest_log_id = latest_log.id if latest_log else since_log_id
        
        # Phase 3: 检测冲突
        conflicts = self.check_conflicts(changes)
        
        return {
            "changes": changes,
            "latest_log_id": latest_log_id,
            "has_more": len(changes) == 1000,
            "conflicts": conflicts  # Phase 3: 返回冲突列表
        }
    
    def apply_changes(self, changes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        将拉取的变更应用到本地数据库
        
        Args:
            changes: 从Hub拉取的变更列表
            
        Returns:
            应用结果
        """
        result = {
            "success": True,
            "applied": 0,
            "skipped": 0,
            "errors": []
        }
        
        for change in changes:
            try:
                applied = self._apply_change(change, is_remote=True)
                if applied:
                    result["applied"] += 1
                else:
                    result["skipped"] += 1
            except Exception as e:
                result["errors"].append({
                    "table": change.get("table_name"),
                    "pk": change.get("record_pk"),
                    "error": str(e)
                })
        
        self.db.commit()
        return result
    
    def _apply_change(
        self,
        change: Dict[str, Any],
        is_remote: bool = False
    ) -> bool:
        """
        应用单条变更
        
        Args:
            change: 变更数据
            is_remote: 是否是远程变更（会进行冲突检测）
            
        Returns:
            是否成功应用
        """
        table_name = change.get("table_name")
        operation = change.get("operation")
        record_pk = change.get("record_pk")
        record_data_str = change.get("record_data")
        change_timestamp = change.get("timestamp")
        
        model = TABLE_MODELS.get(table_name)
        if not model:
            return False
        
        # 解析record_data
        record_data = None
        if record_data_str:
            try:
                record_data = json.loads(record_data_str)
            except json.JSONDecodeError:
                return False
        
        # 获取主键列
        pk_columns = [col for col in model.__table__.columns if col.primary_key]
        if not pk_columns:
            return False
        
        # 解析主键值
        try:
            if len(pk_columns) == 1:
                pk_value = record_pk
                pk_filter = (getattr(model, pk_columns[0].name) == pk_value)
            else:
                pk_dict = json.loads(record_pk)
                pk_filter = and_(*[
                    getattr(model, col.name) == pk_dict.get(col.name)
                    for col in pk_columns
                ])
        except (json.JSONDecodeError, KeyError):
            return False
        
        # 在SyncIgnoreContext中执行，避免触发新的变更日志
        with SyncIgnoreContext(self.device_id):
            if operation == "INSERT":
                return self._apply_insert(model, pk_filter, record_data, change_timestamp)
            elif operation == "UPDATE":
                return self._apply_update(model, pk_filter, record_data, change_timestamp)
            elif operation == "DELETE":
                return self._apply_delete(model, pk_filter)
        
        return False
    
    def _apply_insert(
        self,
        model,
        pk_filter,
        record_data: Optional[Dict],
        change_timestamp: Optional[str]
    ) -> bool:
        """应用INSERT操作"""
        if record_data is None:
            return False
        
        # 检查是否已存在
        existing = self.db.query(model).filter(pk_filter).first()
        if existing:
            # 已存在，跳过（可能已被其他设备创建）
            return False
        
        # 创建新记录
        try:
            # 移除主键，让数据库自动生成
            if 'id' in record_data:
                del record_data['id']
            
            new_record = model(**record_data)
            self.db.add(new_record)
            return True
        except Exception as e:
            print(f"Insert error: {e}")
            return False
    
    def _apply_update(
        self,
        model,
        pk_filter,
        record_data: Optional[Dict],
        change_timestamp: Optional[str]
    ) -> bool:
        """应用UPDATE操作"""
        if record_data is None:
            return False
        
        existing = self.db.query(model).filter(pk_filter).first()
        if not existing:
            # 不存在，尝试插入
            return self._apply_insert(model, pk_filter, record_data, change_timestamp)
        
        # 检查时间戳冲突（Last-Write-Wins）
        if change_timestamp:
            try:
                remote_time = datetime.fromisoformat(change_timestamp.replace('Z', '+00:00'))
                if hasattr(existing, 'updated_at') and existing.updated_at:
                    local_time = existing.updated_at
                    # 如果本地时间更新，跳过
                    if local_time > remote_time:
                        return False
            except (ValueError, TypeError):
                print(f"Warning: {e}")
        
        # 更新记录
        try:
            for key, value in record_data.items():
                if key != 'id' and hasattr(existing, key):
                    setattr(existing, key, value)
            if hasattr(existing, 'updated_at'):
                existing.updated_at = datetime.utcnow()
            return True
        except Exception as e:
            print(f"Update error: {e}")
            return False
    
    def _apply_delete(self, model, pk_filter) -> bool:
        """应用DELETE操作"""
        existing = self.db.query(model).filter(pk_filter).first()
        if not existing:
            # 不存在，跳过
            return False
        
        try:
            self.db.delete(existing)
            return True
        except Exception as e:
            print(f"Delete error: {e}")
            return False
    
    def resolve_conflict(
        self,
        local_data: Optional[Dict],
        remote_data: Optional[Dict]
    ) -> str:
        """
        Last-Write-Wins冲突解决
        
        Args:
            local_data: 本地数据
            remote_data: 远程数据
            
        Returns:
            赢的数据："local" 或 "remote"
        """
        if not local_data:
            return "remote"
        if not remote_data:
            return "local"
        
        local_time = local_data.get("updated_at")
        remote_time = remote_data.get("updated_at")
        
        if not local_time or not remote_time:
            return "remote"  # 默认使用远程数据
        
        try:
            local_dt = datetime.fromisoformat(local_time.replace('Z', '+00:00'))
            remote_dt = datetime.fromisoformat(remote_time.replace('Z', '+00:00'))
            return "remote" if remote_dt > local_dt else "local"
        except (ValueError, TypeError):
            return "remote"
    
    def get_sync_status(self) -> Dict[str, Any]:
        """获取同步状态"""
        # 获取同步状态记录
        state = self.db.query(SyncState).filter(
            SyncState.device_id == self.device_id
        ).first()
        
        # 获取未同步的日志数量
        unsynced_count = self.db.query(SyncLog).filter(
            SyncLog.device_id == self.device_id,
            SyncLog.synced == False
        ).count()
        
        # 获取总日志数
        total_logs = self.db.query(SyncLog).count()
        
        # Phase 3: 获取冲突数量
        conflict_records = self.get_conflict_records()
        conflict_count = len(conflict_records)
        
        return {
            "device_id": self.device_id,
            "last_sync_log_id": state.last_sync_log_id if state else 0,
            "last_sync_time": state.last_sync_time.isoformat() if state and state.last_sync_time else None,
            "unsynced_changes": unsynced_count,
            "total_logs": total_logs,
            "conflict_count": conflict_count  # Phase 3
        }
    
    def update_sync_state(self, last_log_id: int):
        """更新同步状态"""
        state = self.db.query(SyncState).filter(
            SyncState.device_id == self.device_id
        ).first()
        
        if state:
            state.last_sync_log_id = last_log_id
            state.last_sync_time = datetime.utcnow()
        else:
            state = SyncState(
                device_id=self.device_id,
                last_sync_log_id=last_log_id,
                last_sync_time=datetime.utcnow()
            )
            self.db.add(state)
        
        self.db.commit()
    
    def mark_logs_synced(self, log_ids: List[int]):
        """标记日志为已同步"""
        self.db.query(SyncLog).filter(
            SyncLog.id.in_(log_ids)
        ).update({SyncLog.synced: True}, synchronize_session=False)
        self.db.commit()


def create_sync_engine(db: Session, device_id: str) -> SyncEngine:
    """创建同步引擎实例"""
    return SyncEngine(db, device_id)
