"""翻译相关 Schema - 复用learning模块中的TranslationCard schemas"""
from .learning import (
    TranslationCardCreate,
    TranslationCardUpdate,
    TranslationCardResponse
)

__all__ = [
    "TranslationCardCreate",
    "TranslationCardUpdate", 
    "TranslationCardResponse"
]
