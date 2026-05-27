"""翻译相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Path, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.learning import TranslationCard
from schemas.translation import TranslationCardCreate, TranslationCardUpdate, TranslationCardResponse

router = APIRouter(prefix="/translation", tags=["翻译"])

@router.get("/cards", response_model=List[TranslationCardResponse])
def list_translation_cards(skip: int = 0, limit: int = 100, doi: str = None, db: Session = Depends(get_db)):
    query = db.query(TranslationCard)
    if doi:
        query = query.filter(TranslationCard.doi == doi)
    return query.order_by(TranslationCard.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/cards/{id}", response_model=TranslationCardResponse)
def get_translation_card(id: int = Path(...), db: Session = Depends(get_db)):
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
def update_translation_card(id: int = Path(...), data: TranslationCardUpdate = Body(...), db: Session = Depends(get_db)):
    card = db.query(TranslationCard).filter(TranslationCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="翻译卡片不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card

@router.delete("/cards/{id}")
def delete_translation_card(id: int = Path(...), db: Session = Depends(get_db)):
    card = db.query(TranslationCard).filter(TranslationCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="翻译卡片不存在")
    db.delete(card)
    db.commit()
    return {"message": "删除成功"}

@router.post("/cards/{id}/evaluate")
async def evaluate_translation(
    id: int = Path(...),
    data: dict = None,
    db: Session = Depends(get_db)
):
    """AI评价翻译练习"""
    card = db.query(TranslationCard).filter(TranslationCard.id == id).first()
    if not card:
        raise HTTPException(status_code=404, detail="翻译卡片不存在")
    
    translation = data.get("translation", "") if data else ""
    if not translation:
        raise HTTPException(status_code=400, detail="翻译内容不能为空")
    
    # 使用AI服务评价翻译
    from services.ai_service import get_ai_service
    ai = get_ai_service()
    
    try:
        original = card.original_text or ""
        prompt = f"""请评价以下翻译的质量，给出0-100的分数和详细反馈。

原文：{original}
翻译：{translation}

请按以下JSON格式返回：
{{"score": 分数, "feedback": "评价和改进建议", "error_words": ["错误的关键词1", "错误的关键词2"]}}"""
        
        result_text = await ai.chat(
            messages=[{"role": "user", "content": prompt}],
            system="你是一个专业的学术翻译评价助手。请严格评价翻译质量，关注术语准确性、语法正确性和表达自然度。"
        )
        
        # 解析AI返回的JSON
        import json
        import re
        score = 0
        feedback = ""
        error_words = []
        
        try:
            # 尝试提取JSON
            json_match = re.search(r'\{[^}]+\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                score = min(100, max(0, int(result.get("score", 0))))
                feedback = result.get("feedback", "")
                error_words = result.get("error_words", [])
        except (json.JSONDecodeError, ValueError):
            feedback = result_text if result_text else "评价失败"
        
        # 更新卡片
        card.user_translation = translation
        card.ai_score = score
        card.ai_feedback = feedback
        card.error_words = error_words
        
        # 更新复习时间（艾宾浩斯）
        from datetime import datetime, timedelta
        card.last_review = datetime.now()
        if score >= 80:
            card.ebbinghaus_stage = min(card.ebbinghaus_stage + 1, 7)
            review_intervals = [0, 1, 2, 4, 7, 15, 30, 60]  # 天数
            card.next_review = datetime.now() + timedelta(days=review_intervals[card.ebbinghaus_stage])
        else:
            card.next_review = datetime.now() + timedelta(hours=4)
        
        db.commit()
        db.refresh(card)
        
        return {
            "id": card.id,
            "ai_score": card.ai_score,
            "ai_feedback": card.ai_feedback,
            "error_words": card.error_words,
            "ebbinghaus_stage": card.ebbinghaus_stage,
            "next_review": card.next_review.isoformat() if card.next_review else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI评价失败: {str(e)}")
