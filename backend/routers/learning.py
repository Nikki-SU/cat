"""学习相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models.learning import Word, LongSentence, WordList, SentenceList
from schemas.learning import (
    WordCreate, WordUpdate, WordResponse,
    LongSentenceCreate, LongSentenceUpdate, LongSentenceResponse,
    WordListCreate, WordListUpdate, WordListResponse,
    SentenceListCreate, SentenceListUpdate, SentenceListResponse
)

router = APIRouter(prefix="/learning", tags=["学习"])

# Word CRUD
@router.get("/words", response_model=List[WordResponse])
def list_words(skip: int = 0, limit: int = 100, status: str = None, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(Word)
    if status:
        query = query.filter(Word.status == status)
    if doi:
        query = query.filter(Word.doi == doi)
    return query.offset(skip).limit(limit).all()

@router.get("/words/{id}", response_model=WordResponse)
def get_word(id: int, db: Session = Depends(get_db)):
    word = db.query(Word).filter(Word.id == id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    return word

@router.post("/words", response_model=WordResponse)
def create_word(data: WordCreate, db: Session = Depends(get_db)):
    word = Word(**data.model_dump())
    db.add(word)
    db.commit()
    db.refresh(word)
    return word

@router.put("/words/{id}", response_model=WordResponse)
def update_word(id: int, data: WordUpdate, db: Session = Depends(get_db)):
    word = db.query(Word).filter(Word.id == id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(word, key, value)
    db.commit()
    db.refresh(word)
    return word

@router.delete("/words/{id}")
def delete_word(id: int, db: Session = Depends(get_db)):
    word = db.query(Word).filter(Word.id == id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    db.delete(word)
    db.commit()
    return {"message": "删除成功"}

# Long Sentence CRUD
@router.get("/sentences", response_model=List[LongSentenceResponse])
def list_long_sentences(skip: int = 0, limit: int = 100, status: str = None, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(LongSentence)
    if status:
        query = query.filter(LongSentence.status == status)
    if doi:
        query = query.filter(LongSentence.doi == doi)
    return query.offset(skip).limit(limit).all()

@router.get("/sentences/{id}", response_model=LongSentenceResponse)
def get_long_sentence(id: int, db: Session = Depends(get_db)):
    sentence = db.query(LongSentence).filter(LongSentence.id == id).first()
    if not sentence:
        raise HTTPException(status_code=404, detail="长难句不存在")
    return sentence

@router.post("/sentences", response_model=LongSentenceResponse)
def create_long_sentence(data: LongSentenceCreate, db: Session = Depends(get_db)):
    sentence = LongSentence(**data.model_dump())
    db.add(sentence)
    db.commit()
    db.refresh(sentence)
    return sentence

@router.put("/sentences/{id}", response_model=LongSentenceResponse)
def update_long_sentence(id: int, data: LongSentenceUpdate, db: Session = Depends(get_db)):
    sentence = db.query(LongSentence).filter(LongSentence.id == id).first()
    if not sentence:
        raise HTTPException(status_code=404, detail="长难句不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(sentence, key, value)
    db.commit()
    db.refresh(sentence)
    return sentence

@router.delete("/sentences/{id}")
def delete_long_sentence(id: int, db: Session = Depends(get_db)):
    sentence = db.query(LongSentence).filter(LongSentence.id == id).first()
    if not sentence:
        raise HTTPException(status_code=404, detail="长难句不存在")
    db.delete(sentence)
    db.commit()
    return {"message": "删除成功"}

# Word List CRUD
@router.get("/word-lists", response_model=List[WordListResponse])
def list_word_lists(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(WordList).offset(skip).limit(limit).all()

@router.get("/word-lists/{id}", response_model=WordListResponse)
def get_word_list(id: int, db: Session = Depends(get_db)):
    word_list = db.query(WordList).filter(WordList.id == id).first()
    if not word_list:
        raise HTTPException(status_code=404, detail="单词表不存在")
    return word_list

@router.post("/word-lists", response_model=WordListResponse)
def create_word_list(data: WordListCreate, db: Session = Depends(get_db)):
    word_list = WordList(**data.model_dump())
    db.add(word_list)
    db.commit()
    db.refresh(word_list)
    return word_list

@router.put("/word-lists/{id}", response_model=WordListResponse)
def update_word_list(id: int, data: WordListUpdate, db: Session = Depends(get_db)):
    word_list = db.query(WordList).filter(WordList.id == id).first()
    if not word_list:
        raise HTTPException(status_code=404, detail="单词表不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(word_list, key, value)
    db.commit()
    db.refresh(word_list)
    return word_list

@router.delete("/word-lists/{id}")
def delete_word_list(id: int, db: Session = Depends(get_db)):
    word_list = db.query(WordList).filter(WordList.id == id).first()
    if not word_list:
        raise HTTPException(status_code=404, detail="单词表不存在")
    db.delete(word_list)
    db.commit()
    return {"message": "删除成功"}

# Sentence List CRUD
@router.get("/sentence-lists", response_model=List[SentenceListResponse])
def list_sentence_lists(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(SentenceList).offset(skip).limit(limit).all()

@router.get("/sentence-lists/{id}", response_model=SentenceListResponse)
def get_sentence_list(id: int, db: Session = Depends(get_db)):
    sentence_list = db.query(SentenceList).filter(SentenceList.id == id).first()
    if not sentence_list:
        raise HTTPException(status_code=404, detail="长难句表不存在")
    return sentence_list

@router.post("/sentence-lists", response_model=SentenceListResponse)
def create_sentence_list(data: SentenceListCreate, db: Session = Depends(get_db)):
    sentence_list = SentenceList(**data.model_dump())
    db.add(sentence_list)
    db.commit()
    db.refresh(sentence_list)
    return sentence_list

@router.put("/sentence-lists/{id}", response_model=SentenceListResponse)
def update_sentence_list(id: int, data: SentenceListUpdate, db: Session = Depends(get_db)):
    sentence_list = db.query(SentenceList).filter(SentenceList.id == id).first()
    if not sentence_list:
        raise HTTPException(status_code=404, detail="长难句表不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(sentence_list, key, value)
    db.commit()
    db.refresh(sentence_list)
    return sentence_list

@router.delete("/sentence-lists/{id}")
def delete_sentence_list(id: int, db: Session = Depends(get_db)):
    sentence_list = db.query(SentenceList).filter(SentenceList.id == id).first()
    if not sentence_list:
        raise HTTPException(status_code=404, detail="长难句表不存在")
    db.delete(sentence_list)
    db.commit()
    return {"message": "删除成功"}
