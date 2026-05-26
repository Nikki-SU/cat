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
    file_type = Column(String(50), nullable=True, default="markdown")  # markdown/word/excel/pdf/other
    file_data = Column(JSON, nullable=True)  # Excel等结构化数据
    file_path = Column(String(500), nullable=True)  # 导入文件的存储路径
    attachments = Column(JSON, nullable=True)
    template_id = Column(Integer, nullable=True)  # FK removed to avoid table dependency issues
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NoteTemplate(Base):
    """普通笔记模板"""
    __tablename__ = "note_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
