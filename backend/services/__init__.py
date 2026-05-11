"""
服务模块
"""
from .crossref_service import CrossRefService, get_crossref_service, close_crossref_service
from .mineru_service import MinerUService, get_mineru_service, close_mineru_service
from .ai_service import AIService, get_ai_service, close_ai_service

__all__ = [
    "CrossRefService", "get_crossref_service", "close_crossref_service",
    "MinerUService", "get_mineru_service", "close_mineru_service",
    "AIService", "get_ai_service", "close_ai_service"
]
