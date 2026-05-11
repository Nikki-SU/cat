"""
文献相关模型
"""
from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base


class LiteratureEntry(Base):
    """文献条目"""
    __tablename__ = "literature_entries"

    doi = Column(String(255), primary_key=True, index=True)
    title_cn = Column(Text, nullable=True)
    title_en = Column(Text, nullable=True)
    journal = Column(Text, nullable=True)
    author = Column(Text, nullable=True)
    pubdate = Column(Text, nullable=True)
    abstract_cn = Column(Text, nullable=True)
    abstract_en = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LiteratureTableEntry(Base):
    """文献表条目"""
    __tablename__ = "literature_table_entries"

    doi = Column(String(255), primary_key=True, index=True)
    title_cn = Column(Text, nullable=True)
    title_en = Column(Text, nullable=True)
    journal = Column(Text, nullable=True)
    pubdate = Column(Text, nullable=True)
    first_author = Column(Text, nullable=True)
    communication_author = Column(Text, nullable=True)
    has_attachment = Column(Boolean, default=False)
    has_structured = Column(Boolean, default=False)
    has_card = Column(Boolean, default=False)
    has_notes = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
