"""
Pydantic Schemas - 初始化
"""
from .literature import (
    LiteratureEntryCreate, LiteratureEntryUpdate, LiteratureEntryResponse,
    LiteratureTableEntryCreate, LiteratureTableEntryUpdate, LiteratureTableEntryResponse
)
from .tracking import TrackingRecordCreate, TrackingRecordUpdate, TrackingRecordResponse
from .card import (
    LiteratureCardCreate, LiteratureCardUpdate, LiteratureCardResponse,
    CardPromptTemplateCreate, CardPromptTemplateUpdate, CardPromptTemplateResponse,
    CardTemplateCreate, CardTemplateUpdate, CardTemplateResponse
)
from .attachment import AttachmentCreate, AttachmentUpdate, AttachmentResponse
from .structured import (
    StructuredLiteratureCreate, StructuredLiteratureUpdate, StructuredLiteratureResponse,
    StructuredNoteCreate, StructuredNoteUpdate, StructuredNoteResponse
)
from .learning import (
    WordCreate, WordUpdate, WordResponse,
    LongSentenceCreate, LongSentenceUpdate, LongSentenceResponse,
    TranslationCardCreate, TranslationCardUpdate, TranslationCardResponse,
    WordListCreate, WordListUpdate, WordListResponse,
    SentenceListCreate, SentenceListUpdate, SentenceListResponse,
    StudySessionCreate, StudySessionResponse,
    StudySettingsBase, StudySettingsUpdate, StudySettingsResponse,
    QuestionOption, Question, QuestionResponse,
    AnswerSubmit, AnswerResult, StudyStats,
    SentenceTranslationSubmit, SentenceTranslationResult, SentenceDueResponse,
    TranslationSubmit, TranslationResult, TranslationDueResponse
)
from .note import (
    GeneralNoteCreate, GeneralNoteUpdate, GeneralNoteResponse,
    NoteTemplateCreate, NoteTemplateUpdate, NoteTemplateResponse
)
from .organization import (
    TagCreate, TagUpdate, TagResponse,
    CollectionCreate, CollectionUpdate, CollectionResponse,
    CollectionItemCreate, CollectionItemUpdate, CollectionItemResponse,
    JournalGroupCreate, JournalGroupUpdate, JournalGroupResponse,
    KeywordGroupCreate, KeywordGroupUpdate, KeywordGroupResponse
)
from .translation import TranslationCardCreate, TranslationCardUpdate, TranslationCardResponse

__all__ = [
    "LiteratureEntryCreate", "LiteratureEntryUpdate", "LiteratureEntryResponse",
    "LiteratureTableEntryCreate", "LiteratureTableEntryUpdate", "LiteratureTableEntryResponse",
    "TrackingRecordCreate", "TrackingRecordUpdate", "TrackingRecordResponse",
    "LiteratureCardCreate", "LiteratureCardUpdate", "LiteratureCardResponse",
    "CardPromptTemplateCreate", "CardPromptTemplateUpdate", "CardPromptTemplateResponse",
    "CardTemplateCreate", "CardTemplateUpdate", "CardTemplateResponse",
    "AttachmentCreate", "AttachmentUpdate", "AttachmentResponse",
    "StructuredLiteratureCreate", "StructuredLiteratureUpdate", "StructuredLiteratureResponse",
    "StructuredNoteCreate", "StructuredNoteUpdate", "StructuredNoteResponse",
    "WordCreate", "WordUpdate", "WordResponse",
    "LongSentenceCreate", "LongSentenceUpdate", "LongSentenceResponse",
    "TranslationCardCreate", "TranslationCardUpdate", "TranslationCardResponse",
    "WordListCreate", "WordListUpdate", "WordListResponse",
    "SentenceListCreate", "SentenceListUpdate", "SentenceListResponse",
    "StudySessionCreate", "StudySessionResponse",
    "StudySettingsBase", "StudySettingsUpdate", "StudySettingsResponse",
    "QuestionOption", "Question", "QuestionResponse",
    "AnswerSubmit", "AnswerResult", "StudyStats",
    "SentenceTranslationSubmit", "SentenceTranslationResult", "SentenceDueResponse",
    "TranslationSubmit", "TranslationResult", "TranslationDueResponse",
    "GeneralNoteCreate", "GeneralNoteUpdate", "GeneralNoteResponse",
    "NoteTemplateCreate", "NoteTemplateUpdate", "NoteTemplateResponse",
    "TagCreate", "TagUpdate", "TagResponse",
    "CollectionCreate", "CollectionUpdate", "CollectionResponse",
    "CollectionItemCreate", "CollectionItemUpdate", "CollectionItemResponse",
    "JournalGroupCreate", "JournalGroupUpdate", "JournalGroupResponse",
    "KeywordGroupCreate", "KeywordGroupUpdate", "KeywordGroupResponse",
    "TranslationCardCreate", "TranslationCardUpdate", "TranslationCardResponse",
]
