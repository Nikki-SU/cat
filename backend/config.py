"""
应用配置
"""
import os
from pydantic import BaseModel
from typing import Optional


def get_data_dir():
    """Get data directory - delegate to database module to avoid duplication"""
    from database import get_data_dir as _get_data_dir
    return _get_data_dir()


class Settings(BaseModel):
    """应用配置"""
    # API配置
    API_PREFIX: str = "/api/v1"
    
    # 数据库配置 - 支持Android环境变量
    DATABASE_URL: str = os.getenv("DATABASE_URL") or os.getenv("CAT_DB_URL") or "sqlite:///./cat.db"
    
    # CORS配置
    CORS_ORIGINS: list = ["*"]
    
    # AI API配置
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_API_BASE: Optional[str] = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    
    # MinerU配置
    MINERU_API_TOKEN: Optional[str] = os.getenv("MINERU_API_TOKEN")
    MINERU_MODEL_VERSION: str = os.getenv("MINERU_MODEL_VERSION", "vlm")  # pipeline/vlm
    MINERU_LANGUAGE: str = os.getenv("MINERU_LANGUAGE", "en")
    
    # 文件存储配置 - 支持Android环境变量
    ATTACHMENTS_DIR: str = os.getenv("ATTACHMENTS_DIR") or os.getenv("CAT_ATTACHMENTS_DIR") or os.path.join(get_data_dir(), "attachments")
    STRUCTURED_DIR: str = os.getenv("STRUCTURED_DIR") or os.getenv("CAT_STRUCTURED_DIR") or os.path.join(get_data_dir(), "structured")
    
    # 文献追踪配置
    CROSSREF_EMAIL: str = os.getenv("CROSSREF_EMAIL", "cat@example.com")
    TRACKING_INTERVAL: int = 24  # 小时
    
    # 学习配置
    DEFAULT_WORD_QUEUE_LENGTH: int = 20
    DEFAULT_REVIEW_MODE: str = "interval"  # interval or strict
    
    # 显示配置
    DEFAULT_DISPLAY_LANGUAGE: str = os.getenv("DEFAULT_DISPLAY_LANGUAGE", "cn")  # cn or en
    DEFAULT_DISPLAY_DETAIL: str = os.getenv("DEFAULT_DISPLAY_DETAIL", "detailed")  # detailed or brief


settings = Settings()
