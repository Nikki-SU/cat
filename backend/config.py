"""
应用配置
"""
import os
import logging
from pydantic import BaseModel, field_validator
from typing import Optional, List

logger = logging.getLogger(__name__)


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
    
    # CORS配置 - 隐私优先：默认仅允许本地访问
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:7860,http://127.0.0.1:7860,http://localhost:8000,http://127.0.0.1:8000").split(",") if os.getenv("CORS_ORIGINS") else ["http://localhost:7860", "http://127.0.0.1:7860", "http://localhost:8000", "http://127.0.0.1:8000"]
    CORS_ALLOW_CREDENTIALS: bool = os.getenv("CORS_ALLOW_CREDENTIALS", "false").lower() == "true"
    
    # 隐私配置 - 完全离线模式
    OFFLINE_MODE: bool = os.getenv("OFFLINE_MODE", "false").lower() == "true"
    ALLOW_LAN_SYNC: bool = os.getenv("ALLOW_LAN_SYNC", "true").lower() == "true"
    ALLOW_LOCAL_AI: bool = os.getenv("ALLOW_LOCAL_AI", "true").lower() == "true"
    ALLOW_EXTERNAL_AI: bool = os.getenv("ALLOW_EXTERNAL_AI", "false").lower() == "true"
    WARN_BEFORE_EXTERNAL_REQUESTS: bool = os.getenv("WARN_BEFORE_EXTERNAL_REQUESTS", "true").lower() == "true"
    
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
    
    # 文献追踪配置 - 默认匿名，保护隐私
    CROSSREF_EMAIL: str = os.getenv("CROSSREF_EMAIL", "anonymous@local.device")
    TRACKING_INTERVAL: int = 24  # 小时
    
    # 学习配置
    DEFAULT_WORD_QUEUE_LENGTH: int = 20
    DEFAULT_REVIEW_MODE: str = "interval"  # interval or strict
    
    # 显示配置
    DEFAULT_DISPLAY_LANGUAGE: str = os.getenv("DEFAULT_DISPLAY_LANGUAGE", "cn")  # cn or en
    DEFAULT_DISPLAY_DETAIL: str = os.getenv("DEFAULT_DISPLAY_DETAIL", "detailed")  # detailed or brief
    
    # 网络发现配置
    ENABLE_DISCOVERY: bool = os.getenv("ENABLE_DISCOVERY", "true").lower() == "true"
    DEVICE_NAME: str = os.getenv("DEVICE_NAME", os.getenv("HOSTNAME", "Cat设备"))
    
    def get_privacy_status(self) -> dict:
        """获取当前隐私状态"""
        return {
            "offline_mode": self.OFFLINE_MODE,
            "lan_sync": self.ALLOW_LAN_SYNC,
            "local_ai": self.ALLOW_LOCAL_AI,
            "external_ai": self.ALLOW_EXTERNAL_AI,
            "external_requests_warning": self.WARN_BEFORE_EXTERNAL_REQUESTS,
            "cors_origins_count": len(self.CORS_ORIGINS),
            "is_restrictive_cors": len(self.CORS_ORIGINS) <= 4 and all("localhost" in o or "127.0.0.1" in o for o in self.CORS_ORIGINS)
        }
    
    def is_safe_for_local_use(self) -> bool:
        """检查配置是否安全用于本地使用"""
        status = self.get_privacy_status()
        return (
            status["offline_mode"] or
            (status["is_restrictive_cors"] and not status["external_ai"])
        )


settings = Settings()

# 启动时检查隐私配置
if settings.OFFLINE_MODE:
    logger.info("🔒 隐私模式：完全离线，所有外部服务已禁用")
elif settings.WARN_BEFORE_EXTERNAL_REQUESTS:
    logger.info("⚠️ 外部服务已启用，将在发送敏感数据前提示")
