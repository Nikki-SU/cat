"""
文献卡片相关模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from database import Base


class LiteratureCard(Base):
    """文献卡片"""
    __tablename__ = "literature_cards"

    doi = Column(String(255), primary_key=True, index=True)
    title_cn = Column(Text, nullable=False)
    title_en = Column(Text, nullable=False)
    journal = Column(Text, nullable=False)
    author = Column(Text, nullable=False)
    pubdate = Column(Text, nullable=False)
    abstract_cn = Column(Text, nullable=False)
    abstract_en = Column(Text, nullable=False)
    keyword_cn = Column(Text, nullable=False)
    keyword_en = Column(Text, nullable=False)
    cover_image = Column(Text, nullable=True)
    extra_fields = Column(JSON, nullable=True)
    template_id = Column(Integer, ForeignKey("card_templates.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CardPromptTemplate(Base):
    """文献卡片提示词模板"""
    __tablename__ = "card_prompt_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CardTemplate(Base):
    """文献卡片模板"""
    __tablename__ = "card_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    prompt_template_id = Column(Integer, ForeignKey("card_prompt_templates.id"), nullable=True)
    name = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
