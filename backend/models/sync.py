"""
同步相关数据模型 - Hub/Leaf去中心化同步
"""
from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base


class Device(Base):
    """注册设备表"""
    __tablename__ = "devices"
    
    device_id = Column(String(64), primary_key=True)  # UUID
    device_name = Column(String(128), nullable=False)  # "小N的电脑"
    device_type = Column(String(32), nullable=False)   # "computer" / "phone" / "tablet"
    role = Column(String(16), nullable=False)           # "hub" / "leaf"
    last_seen = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    # Leaf连接Hub时，Hub记录Leaf的信息
    hub_url = Column(String(512), nullable=True)        # Leaf连接的Hub地址
    is_online = Column(Boolean, default=False)


class SyncLog(Base):
    """变更日志表 - 记录每次数据库写操作"""
    __tablename__ = "sync_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(64), nullable=False)      # 哪个设备产生的变更
    table_name = Column(String(64), nullable=False)     # 表名
    operation = Column(String(16), nullable=False)      # INSERT / UPDATE / DELETE
    record_pk = Column(String(256), nullable=False)     # 主键值（JSON字符串，复合主键用）
    record_data = Column(Text, nullable=True)           # 完整记录数据（JSON）
    timestamp = Column(DateTime, server_default=func.now())
    synced = Column(Boolean, default=False)             # 是否已同步到Hub


class SyncState(Base):
    """同步状态表 - 记录每个设备的同步进度"""
    __tablename__ = "sync_state"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(64), nullable=False)
    last_sync_log_id = Column(Integer, default=0)       # 该设备已同步到的日志ID
    last_sync_time = Column(DateTime)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
