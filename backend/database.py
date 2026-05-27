"""
数据库配置 - 设备文件系统存储
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def get_data_dir():
    """Get data directory, supporting PyInstaller bundle, desktop and Android"""
    import sys
    # 环境变量优先
    if os.getenv("CAT_DATA_DIR"):
        return os.getenv("CAT_DATA_DIR")
    # PyInstaller 打包模式：数据放用户目录
    if getattr(sys, "frozen", False):
        if sys.platform == "win32":
            return os.path.join(os.getenv("APPDATA", os.path.expanduser("~")), "Cat")
        elif sys.platform == "darwin":
            return os.path.expanduser("~/Library/Application Support/Cat")
        else:
            return os.path.join(os.getenv("XDG_DATA_HOME", os.path.expanduser("~/.local/share")), "Cat")
    # 开发模式
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




def _migrate_db():
    """数据库迁移：为已有表添加缺失的列（SQLite兼容）"""
    import sqlite3
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    
    # 定义每个表可能缺失的列
    migrations = {
        "general_notes": [
            ("file_type", "VARCHAR(50) DEFAULT 'markdown'),
            ("file_data", "JSON"),
            ("file_path", "VARCHAR(500)"),
            ("attachments", "JSON"),
            ("template_id", "INTEGER"),
        ],
        "literature_table_entries": [
            ("has_notes", "BOOLEAN DEFAULT 0"),
        ],
    }
    
    for table_name, columns in migrations.items():
        if table_name not in tables:
            continue
        # 获取已有列
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_cols = {row[1] for row in cursor.fetchall()}
        # 添加缺失列
        for col_name, col_type in columns:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                    print(f"[DB Migration] Added {table_name}.{col_name}")
                except Exception as e:
                    print(f"[DB Migration] Skip {table_name}.{col_name}: {e}")
    
    conn.commit()
    conn.close()

def init_db():
    """初始化数据库 - 创建所有表"""
    from models import literature, tracking, card, attachment, structured, learning, note, organization, translation, sync
    Base.metadata.create_all(bind=engine)
    _migrate_db()


def setup_change_tracking():
    """设置变更追踪（需要在SessionLocal创建后调用）"""
    from services.change_tracker import setup_change_tracking
    setup_change_tracking(SessionLocal)
