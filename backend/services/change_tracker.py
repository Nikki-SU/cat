"""
变更自动追踪 - SQLAlchemy事件监听
使用 after_insert, after_update, after_delete 事件自动将所有数据库写操作记录到sync_log
"""
import json
from datetime import datetime
from contextvars import ContextVar
from typing import Optional
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine

# 全局上下文变量存储当前设备ID
_current_device_id: ContextVar[Optional[str]] = ContextVar('current_device_id', default=None)

# 需要追踪的表名列表（与sync_service.py保持一致）
TRACKED_TABLES = [
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

# 需要排除的表（避免循环）
EXCLUDED_TABLES = {"sync_log", "devices", "sync_state"}


def get_current_device_id() -> Optional[str]:
    """获取当前请求的设备ID"""
    return _current_device_id.get()


def set_current_device_id(device_id: str):
    """设置当前请求的设备ID"""
    _current_device_id.set(device_id)


def clear_current_device_id():
    """清除当前请求的设备ID"""
    _current_device_id.set(None)


def get_table_name_from_model(model) -> str:
    """从模型类获取表名"""
    return model.__tablename__


def record_to_json(record) -> str:
    """将模型记录转换为JSON字符串"""
    if record is None:
        return None
    
    data = {}
    for column in record.__table__.columns:
        value = getattr(record, column.name)
        if isinstance(value, datetime):
            data[column.name] = value.isoformat()
        else:
            data[column.name] = value
    return json.dumps(data, ensure_ascii=False)


def get_primary_key_value(record) -> str:
    """获取记录的主键值"""
    pk_columns = [col for col in record.__table__.columns if col.primary_key]
    
    if len(pk_columns) == 1:
        return str(getattr(record, pk_columns[0].name))
    else:
        # 复合主键
        pk_values = {col.name: getattr(record, col.name) for col in pk_columns}
        return json.dumps(pk_values, ensure_ascii=False)


def setup_change_tracking(session_factory):
    """
    设置SQLAlchemy事件监听
    需要在创建SessionLocal之后调用
    """
    
    def is_tracked_table(table_name: str) -> bool:
        """检查表是否需要追踪"""
        if table_name in EXCLUDED_TABLES:
            return False
        # 检查是否是已知的追踪表（通过表名匹配）
        for tracked in TRACKED_TABLES:
            if tracked in table_name or table_name in tracked:
                return True
        return False
    
    @event.listens_for(session_factory, "before_commit")
    def receive_before_commit(session):
        """在提交前处理所有待记录的变更"""
        # 延迟导入避免循环
        from models.sync import SyncLog
        
        # 遍历session中的所有对象
        for obj in session.new:
            table_name = get_table_name_from_model(type(obj))
            if not is_tracked_table(table_name):
                continue
            
            device_id = get_current_device_id() or "unknown"
            
            # 跳过已标记为忽略同步的对象
            if getattr(obj, '_sync_ignore', False):
                continue
            
            log_entry = SyncLog(
                device_id=device_id,
                table_name=table_name,
                operation="INSERT",
                record_pk=get_primary_key_value(obj),
                record_data=record_to_json(obj),
                synced=False
            )
            session.add(log_entry)
        
        for obj in session.dirty:
            table_name = get_table_name_from_model(type(obj))
            if not is_tracked_table(table_name):
                continue
            
            device_id = get_current_device_id() or "unknown"
            
            # 跳过已标记为忽略同步的对象
            if getattr(obj, '_sync_ignore', False):
                continue
            
            # 检查是否有实际变化
            if not session.is_modified(obj):
                continue
            
            log_entry = SyncLog(
                device_id=device_id,
                table_name=table_name,
                operation="UPDATE",
                record_pk=get_primary_key_value(obj),
                record_data=record_to_json(obj),
                synced=False
            )
            session.add(log_entry)
        
        for obj in session.deleted:
            table_name = get_table_name_from_model(type(obj))
            if not is_tracked_table(table_name):
                continue
            
            device_id = get_current_device_id() or "unknown"
            
            # 跳过已标记为忽略同步的对象
            if getattr(obj, '_sync_ignore', False):
                continue
            
            log_entry = SyncLog(
                device_id=device_id,
                table_name=table_name,
                operation="DELETE",
                record_pk=get_primary_key_value(obj),
                record_data=record_to_json(obj),
                synced=False
            )
            session.add(log_entry)


def mark_ignore_sync(obj):
    """标记对象忽略同步追踪"""
    obj._sync_ignore = True


class SyncIgnoreContext:
    """上下文管理器：临时禁用同步追踪"""
    
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.previous_id = None
    
    def __enter__(self):
        self.previous_id = get_current_device_id()
        set_current_device_id(self.device_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.previous_id is not None:
            set_current_device_id(self.previous_id)
        else:
            clear_current_device_id()
        return False
