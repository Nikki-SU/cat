"""文献卡片相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.card import LiteratureCard, CardPromptTemplate, CardTemplate
from schemas.card import (
    LiteratureCardCreate, LiteratureCardUpdate, LiteratureCardResponse,
    CardPromptTemplateCreate, CardPromptTemplateUpdate, CardPromptTemplateResponse,
    CardTemplateCreate, CardTemplateUpdate, CardTemplateResponse
)

router = APIRouter(prefix="/cards", tags=["文献卡片"])

# Literature Card CRUD
@router.get("/literature", response_model=List[LiteratureCardResponse])
def list_literature_cards(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(LiteratureCard).offset(skip).limit(limit).all()

@router.get("/literature/{doi}", response_model=LiteratureCardResponse)
def get_literature_card(doi: str, db: Session = Depends(get_db)):
    card = db.query(LiteratureCard).filter(LiteratureCard.doi == doi).first()
    if not card:
        raise HTTPException(status_code=404, detail="文献卡片不存在")
    return card

@router.post("/literature", response_model=LiteratureCardResponse)
def create_literature_card(data: LiteratureCardCreate, db: Session = Depends(get_db)):
    card = LiteratureCard(**data.model_dump())
    db.add(card)
    db.commit()
    db.refresh(card)
    return card

@router.put("/literature/{doi}", response_model=LiteratureCardResponse)
def update_literature_card(doi: str, data: LiteratureCardUpdate, db: Session = Depends(get_db)):
    card = db.query(LiteratureCard).filter(LiteratureCard.doi == doi).first()
    if not card:
        raise HTTPException(status_code=404, detail="文献卡片不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card

@router.delete("/literature/{doi}")
def delete_literature_card(doi: str, db: Session = Depends(get_db)):
    card = db.query(LiteratureCard).filter(LiteratureCard.doi == doi).first()
    if not card:
        raise HTTPException(status_code=404, detail="文献卡片不存在")
    db.delete(card)
    db.commit()
    return {"message": "删除成功"}

# Card Prompt Template CRUD
@router.get("/prompt-templates", response_model=List[CardPromptTemplateResponse])
def list_prompt_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(CardPromptTemplate).offset(skip).limit(limit).all()

@router.get("/prompt-templates/{id}", response_model=CardPromptTemplateResponse)
def get_prompt_template(id: int, db: Session = Depends(get_db)):
    template = db.query(CardPromptTemplate).filter(CardPromptTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    return template

@router.post("/prompt-templates", response_model=CardPromptTemplateResponse)
def create_prompt_template(data: CardPromptTemplateCreate, db: Session = Depends(get_db)):
    template = CardPromptTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/prompt-templates/{id}", response_model=CardPromptTemplateResponse)
def update_prompt_template(id: int, data: CardPromptTemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(CardPromptTemplate).filter(CardPromptTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    db.commit()
    db.refresh(template)
    return template

@router.delete("/prompt-templates/{id}")
def delete_prompt_template(id: int, db: Session = Depends(get_db)):
    template = db.query(CardPromptTemplate).filter(CardPromptTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="提示词模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "删除成功"}

# Card Template CRUD
@router.get("/templates", response_model=List[CardTemplateResponse])
def list_card_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(CardTemplate).offset(skip).limit(limit).all()

@router.get("/templates/{id}", response_model=CardTemplateResponse)
def get_card_template(id: int, db: Session = Depends(get_db)):
    template = db.query(CardTemplate).filter(CardTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="卡片模板不存在")
    return template

@router.post("/templates", response_model=CardTemplateResponse)
def create_card_template(data: CardTemplateCreate, db: Session = Depends(get_db)):
    template = CardTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/templates/{id}", response_model=CardTemplateResponse)
def update_card_template(id: int, data: CardTemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(CardTemplate).filter(CardTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="卡片模板不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    db.commit()
    db.refresh(template)
    return template

@router.delete("/templates/{id}")
def delete_card_template(id: int, db: Session = Depends(get_db)):
    template = db.query(CardTemplate).filter(CardTemplate.id == id).first()
    if not template:
        raise HTTPException(status_code=404, detail="卡片模板不存在")
    db.delete(template)
    db.commit()
    return {"message": "删除成功"}
