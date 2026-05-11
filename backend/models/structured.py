"""
缁撴瀯鎬ф枃鐚浉鍏虫ā鍨?"""
from sqlalchemy import Column, String, Text, Integer, DateTime
from sqlalchemy.sql import func
from database import Base


class StructuredLiterature(Base):
    """缁撴瀯鎬ф枃鐚?""
    __tablename__ = "structured_literatures"

    doi = Column(String(255), primary_key=True, index=True)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StructuredNote(Base):
    """缁撴瀯鎬ф枃鐚瑪璁?- Obsidian椋庢牸"""
    __tablename__ = "structured_notes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    doi = Column(String(255), nullable=True, index=True)
    
    # 閿氱偣瀹氫綅
    anchor_id = Column(String(255), nullable=True, index=True)  # 娈佃惤閿氱偣ID
    anchor_type = Column(String(50), default="paragraph")  # paragraph | heading | block
    anchor_text = Column(Text, nullable=True)  # 閿氱偣鍘熸枃锛堢敤浜庢樉绀轰笂涓嬫枃锛?    
    # 绗旇鍐呭
    note_type = Column(String(50), default="markdown")  # markdown | image | code | mermaid | link
    content = Column(Text, nullable=True)  # 绗旇鍐呭锛圡arkdown鏍煎紡锛?    
    # 棰濆鏁版嵁
    metadata = Column(JSON, nullable=True)  # { imageUrl, codeLanguage, linkTarget, mermaidType, ... }
    tags = Column(JSON, nullable=True)  # ["鏍囩1", "鏍囩2"]
    
    # 浣嶇疆淇℃伅锛堢敤浜庣簿鍑嗗畾浣嶏級
    position_start = Column(Integer, nullable=True)  # 鍦ㄦ钀戒腑鐨勮捣濮嬩綅缃?    position_end = Column(Integer, nullable=True)    # 鍦ㄦ钀戒腑鐨勭粨鏉熶綅缃?    
    # 鏍峰紡
    color = Column(String(50), nullable=True)  # 楂樹寒棰滆壊
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
