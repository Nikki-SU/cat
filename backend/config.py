"""
应用配置
"""
import os
from pydantic import BaseModel
from typing import Optional


class Settings(BaseModel):
    """应用配置"""
    # API配置
    API_PREFIX: str = "/api/v1"
    
    # 数据库配置
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./cat.db")
    
    # CORS配置
    CORS_ORIGINS: list = ["*"]
    
    # AI API配置
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_API_BASE: Optional[str] = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    
    # MinerU配置
    MINERU_API_TOKEN: Optional[str] = os.getenv("MINERU_API_TOKEN")
    
    # 文献追踪配置
    CROSSREF_EMAIL: str = os.getenv("CROSSREF_EMAIL", "cat@example.com")
    TRACKING_INTERVAL: int = 24  # 小时
    
    # 学习配置
    DEFAULT_WORD_QUEUE_LENGTH: int = 20
    DEFAULT_REVIEW_MODE: str = "interval"  # interval or strict
    
    # 显示配置
    DEFAULT_DISPLAY_LANGUAGE: str = "cn"  # cn or en
    DEFAULT_DISPLAY_DETAIL: str = "detailed"  # detailed or brief


settings = Settings()
