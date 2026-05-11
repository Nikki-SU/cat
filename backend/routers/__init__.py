"""API路由初始化"""
from . import (
    literature, tracking, card, attachment, structured,
    learning, note, organization, translation, ai_proxy, backup
)

__all__ = [
    "literature", "tracking", "card", "attachment", "structured",
    "learning", "note", "organization", "translation", "ai_proxy", "backup"
]
