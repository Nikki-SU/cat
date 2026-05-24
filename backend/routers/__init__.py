"""API路由初始化"""
from . import (
    literature, tracking, card, attachment, structured,
    learning, note, organization, translation, ai_proxy, backup,
    settings, note_image, note_ocr, sync_v2, pairing
)

__all__ = [
    "literature", "tracking", "card", "attachment", "structured",
    "learning", "note", "organization", "translation", "ai_proxy", "backup",
    "settings", "note_image", "note_ocr", "sync_v2", "pairing"
]
