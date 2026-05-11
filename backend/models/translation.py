"""
翻译相关模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class TranslationCard(Base):
    """摘要翻译卡片"""
    __tablename__ = "translation_cards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doi = Column(String(255), nullable=True, index=True)
    original_text = Column(Text, nullable=False)
    user_translation = Column(Text, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    error_words = Column(JSON, nullable=True)  # 错词列表(加入生词本)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
