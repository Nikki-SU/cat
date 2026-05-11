"""
学习相关模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from database import Base


class Word(Base):
    """单词"""
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    word_en = Column(String(255), nullable=False)
    word_cn = Column(String(255), nullable=True)
    definition_en = Column(Text, nullable=True)
    definition_cn = Column(Text, nullable=True)
    sentence = Column(Text, nullable=True)
    doi = Column(String(255), nullable=True, index=True)
    status = Column(String(20), default="new")  # new/learning/mastered
    review_count = Column(Integer, default=0)
    last_review = Column(DateTime(timezone=True), nullable=True)
    next_review = Column(DateTime(timezone=True), nullable=True)
    correct_streak = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LongSentence(Base):
    """长难句"""
    __tablename__ = "long_sentences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sentence_en = Column(Text, nullable=False)
    sentence_cn = Column(Text, nullable=True)
    doi = Column(String(255), nullable=True, index=True)
    status = Column(String(20), default="new")  # new/learning/mastered
    review_count = Column(Integer, default=0)
    last_review = Column(DateTime(timezone=True), nullable=True)
    next_review = Column(DateTime(timezone=True), nullable=True)
    correct_streak = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WordList(Base):
    """单词表"""
    __tablename__ = "word_lists"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    doi = Column(String(255), nullable=True, index=True)
    word_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SentenceList(Base):
    """长难句表"""
    __tablename__ = "sentence_lists"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    doi = Column(String(255), nullable=True, index=True)
    sentence_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
