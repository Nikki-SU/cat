"""翻译相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.translation import TranslationCard
from schemas.translation import TranslationCardCreate, TranslationCardUpdate, TranslationCardResponse

router = APIRouter(prefix="/translation", tags=["翻译"])

@router.get("/cards", response_model=List[TranslationCardResponse])
def list_translation_cards(skip: int = 0, limit: int = 100, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(TranslationCard)
    if doi:
        query = query.filter(TranslationCard.doi == doi)
    return query.order_by(TranslationCard.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/cards/{id}", response_model=TranslationCardResponse)
def get_translation_card(id: int, db: Session = Depends(get_db)):
    card = db.query(TranslationCard).filter(TranslationCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="翻译卡片不存在")
    return card

@router.post("/cards", response_model=TranslationCardResponse)
def create_translation_card(data: TranslationCardCreate, db: Session = Depends(get_db)):
    card = TranslationCard(**data.model_dump())
    db.add(card)
    db.commit()
    db.refresh(card)
    return card

@router.put("/cards/{id}", response_model=TranslationCardResponse)
def update_translation_card(id: int, data: TranslationCardUpdate, db: Session = Depends(get_db)):
    card = db.query(TranslationCard).filter(TranslationCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="翻译卡片不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card

@router.delete("/cards/{id}")
def delete_translation_card(id: int, db: Session = Depends(get_db)):
    card = db.query(TranslationCard).filter(TranslationCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="翻译卡片不存在")
    db.delete(card)
    db.commit()
    return {"message": "删除成功"}
