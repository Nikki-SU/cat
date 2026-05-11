"""
组织相关模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class Tag(Base):
    """标签"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    doi = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Collection(Base):
    """合集"""
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CollectionItem(Base):
    """合集条目"""
    __tablename__ = "collection_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=False, index=True)
    item_type = Column(String(50), nullable=False)  # word/long_sentence/literature_card/...
    item_id = Column(Integer, nullable=False)
    doi = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JournalGroup(Base):
    """期刊合集"""
    __tablename__ = "journal_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    journals = Column(JSON, nullable=True)  # 期刊名称列表
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KeywordGroup(Base):
    """关键词合集"""
    __tablename__ = "keyword_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    keywords = Column(JSON, nullable=True)  # [{word, logic: 'and'/'or'/'not'}] 最多10个
    created_at = Column(DateTime(timezone=True), server_default=func.now())
