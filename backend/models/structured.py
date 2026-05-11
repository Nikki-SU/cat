"""
结构性文献相关模型
"""
from sqlalchemy import Column, String, Text, Integer, DateTime
from sqlalchemy.sql import func
from database import Base


class StructuredLiterature(Base):
    """结构性文献"""
    __tablename__ = "structured_literatures"

    doi = Column(String(255), primary_key=True, index=True)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StructuredNote(Base):
    """结构性文献笔记"""
    __tablename__ = "structured_notes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doi = Column(String(255), nullable=True, index=True)
    note_type = Column(String(50), nullable=False)  # image/markdown/code/table/link
    content = Column(Text, nullable=True)
    position = Column(String(255), nullable=True)  # 在原文中的锚点位置
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
