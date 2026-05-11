"""
数据库配置 - 设备文件系统存储
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 数据目录配置 - 默认 ./data/
DATA_DIR = os.getenv("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)

# SQLite 数据库文件路径
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'cat.db')}")

# 附件存储目录
ATTACHMENTS_DIR = os.getenv("ATTACHMENTS_DIR", os.path.join(DATA_DIR, "attachments"))
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
    from models import literature, tracking, card, attachment, structured, learning, note, organization, translation
    Base.metadata.create_all(bind=engine)
