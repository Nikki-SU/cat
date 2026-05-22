"""
数据库配置 - 设备文件系统存储
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def get_data_dir():
    """Get data directory, supporting both desktop and Android environments"""
    # Android/Chaquopy: data directory passed from PythonService
    if os.getenv("CAT_DATA_DIR"):
        return os.getenv("CAT_DATA_DIR")
    # Desktop: use backend/data relative path
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


# 数据目录配置 - 与config.py保持一致
DATA_DIR = get_data_dir()
os.makedirs(DATA_DIR, exist_ok=True)

# SQLite 数据库文件路径
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'cat.db')}")

# 附件存储目录 - 与config.py保持一致
_ATTACHMENTS_DIR = os.getenv("ATTACHMENTS_DIR") or os.getenv("CAT_ATTACHMENTS_DIR")
ATTACHMENTS_DIR = _ATTACHMENTS_DIR if _ATTACHMENTS_DIR else os.path.join(DATA_DIR, "attachments")
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

# 为SQLite创建连接
connect_args = {"check_same_thread": False}
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库 - 创建所有表"""
    from models import literature, tracking, card, attachment, structured, learning, note, organization, translation, sync
    Base.metadata.create_all(bind=engine)


def setup_change_tracking():
    """设置变更追踪（需要在SessionLocal创建后调用）"""
    from services.change_tracker import setup_change_tracking
    setup_change_tracking(SessionLocal)
