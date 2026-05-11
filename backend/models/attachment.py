"""
附件相关模型
"""
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime
from sqlalchemy.sql import func
from database import Base


class LiteratureAttachment(Base):
    """文献附件"""
    __tablename__ = "literature_attachments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doi = Column(String(255), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # doc/docx/pdf/epub/markdown
    file_data = Column(LargeBinary, nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
