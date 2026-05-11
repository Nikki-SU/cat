"""
笔记相关模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class GeneralNote(Base):
    """普通笔记"""
    __tablename__ = "general_notes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=True)
    doi = Column(String(255), nullable=True, index=True)
    attachments = Column(JSON, nullable=True)
    template_id = Column(Integer, ForeignKey("note_templates.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NoteTemplate(Base):
    """普通笔记模板"""
    __tablename__ = "note_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
