"""
数据库模型 - 初始化
"""
from .literature import LiteratureEntry, LiteratureTableEntry
from .tracking import TrackingRecord
from .card import LiteratureCard, CardPromptTemplate, CardTemplate
from .attachment import LiteratureAttachment
from .structured import StructuredLiterature, StructuredNote
from .learning import Word, LongSentence, TranslationCard, WordList, SentenceList, StudySession, StudySettings
from .note import GeneralNote, NoteTemplate
from .organization import Tag, Collection, CollectionItem, JournalGroup, KeywordGroup

__all__ = [
    # 文献相关
    "LiteratureEntry",
    "LiteratureTableEntry",
    "TrackingRecord",
    "LiteratureCard",
    "LiteratureAttachment",
    "StructuredLiterature",
    "StructuredNote",
    # 学习相关
    "Word",
    "LongSentence",
    "TranslationCard",
    "WordList",
    "SentenceList",
    "StudySession",
    "StudySettings",
    # 笔记相关
    "GeneralNote",
    "NoteTemplate",
    # 组织相关
    "Tag",
    "Collection",
    "CollectionItem",
    "JournalGroup",
    "KeywordGroup",
    # 模板相关
    "CardPromptTemplate",
    "CardTemplate",
]
