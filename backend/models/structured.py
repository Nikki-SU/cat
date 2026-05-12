"""
结构性文献相关模型
"""
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
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
    """结构性文献笔记 - Obsidian风格"""
    __tablename__ = "structured_notes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doi = Column(String(255), nullable=True, index=True)
    
    # 锚点定位
    anchor_id = Column(String(255), nullable=True, index=True)  # 段落锚点ID
    anchor_type = Column(String(50), default="paragraph")  # paragraph | heading | block
    anchor_text = Column(Text, nullable=True)  # 锚点原文
    
    # 笔记内容
    note_type = Column(String(50), default="markdown")  # markdown | image | code | mermaid | link
    content = Column(Text, nullable=True)  # 笔记内容
    
    # 额外数据
    meta_data = Column(JSON, nullable=True)  # { imageUrl, codeLanguage, linkTarget, mermaidType, ... }
    tags = Column(JSON, nullable=True)  # 标签列表
    
    # 位置信息
    position_start = Column(Integer, nullable=True)
    position_end = Column(Integer, nullable=True)
    
    # 样式
    color = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
