"""
追踪相关模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class TrackingRecord(Base):
    """文献追踪记录"""
    __tablename__ = "tracking_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String(50), nullable=True)
    journal = Column(Text, nullable=True)
    title_cn = Column(Text, nullable=True)
    title_en = Column(Text, nullable=True)
    doi = Column(String(255), nullable=True, index=True)
    action = Column(String(20), default="added")  # added/deleted/kept
    created_at = Column(DateTime(timezone=True), server_default=func.now())
