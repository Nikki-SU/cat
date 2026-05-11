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
    """结构性文献笔记 - Obsidian风格"""
    __tablename__ = "structured_notes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doi = Column(String(255), nullable=True, index=True)
    
    # 锚点定位
    anchor_id = Column(String(255), nullable=True, index=True)  # 段落锚点ID
    anchor_type = Column(String(50), default="paragraph")  # paragraph | heading | block
    anchor_text = Column(Text, nullable=True)  # 锚点原文（用于显示上下文）
    
    # 笔记内容
    note_type = Column(String(50), default="markdown")  # markdown | image | code | mermaid | link
    content = Column(Text, nullable=True)  # 笔记内容（Markdown格式）
    
    # 额外数据
    metadata = Column(JSON, nullable=True)  # { imageUrl, codeLanguage, linkTarget, mermaidType, ... }
    tags = Column(JSON, nullable=True)  # ["标签1", "标签2"]
    
    # 位置信息（用于精准定位）
    position_start = Column(Integer, nullable=True)  # 在段落中的起始位置
    position_end = Column(Integer, nullable=True)    # 在段落中的结束位置
    
    # 样式
    color = Column(String(50), nullable=True)  # 高亮颜色
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
