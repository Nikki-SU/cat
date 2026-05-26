"""AI 代理相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from database import get_db
from services.ai_service import get_ai_service, update_ai_service, AIService
from services.crossref_service import get_crossref_service, CrossRefService
from models.card import CardTemplate, LiteratureCard
from schemas.card import LiteratureCardCreate

router = APIRouter(prefix="/ai", tags=["AI"])


def get_ai() -> AIService:
    return get_ai_service()


def get_crossref() -> CrossRefService:
    return get_crossref_service()


# ==================== AI 配置 ====================

@router.post("/config")
def configure_ai(
    api_key: str = Body(...),
    api_base: Optional[str] = Body(None),
    model: Optional[str] = Body(None)
):
    """配置AI服务"""
    update_ai_service(api_key=api_key, api_base=api_base, model=model)
    return {"success": True, "message": "AI配置已更新"}


@router.post("/test")
async def test_ai_connection(ai: AIService = Depends(get_ai)):
    """测试AI连接"""
    result = await ai.chat(
        messages=[{"role": "user", "content": "Hello, please respond with 'OK' if you can understand this message."}],
        max_tokens=50
    )
    return result


# ==================== 翻译 ====================

@router.post("/translate")
async def translate_text(
    text: str,
    target_lang: str = Query(default="Chinese"),
    ai: AIService = Depends(get_ai)
):
    """
    翻译文本
    
    Args:
        text: 待翻译文本
        target_lang: 目标语言
    """
    result = await ai.translate(text, target_lang)
    return result


@router.post("/translate-doi")
async def translate_doi_metadata(
    doi: str,
    crossref: CrossRefService = Depends(get_crossref),
    ai: AIService = Depends(get_ai)
):
    """
    获取DOI元数据并翻译标题和摘要
    
    Args:
        doi: DOI标识符
    """
    work = await crossref.search_by_doi(doi)
    if not work:
        raise HTTPException(status_code=404, detail="DOI不存在")
    
    title_en = work.get("title", "")
    abstract_en = work.get("abstract", "")
    
    translation = await ai.translate_title_abstract(title_en, abstract_en)
    
    return {
        "doi": doi,
        "title_en": title_en,
        "abstract_en": abstract_en,
        "title_cn": translation.get("title_cn", ""),
        "abstract_cn": translation.get("abstract_cn", ""),
        "translation_success": translation.get("success", False),
        "translation_error": translation.get("error")
    }


# ==================== 单词学习 ====================

@router.post("/complete-word")
async def complete_word_entry(
    word_en: str,
    context: str = None,
    ai: AIService = Depends(get_ai)
):
    """
    AI补全单词条目
    
    Args:
        word_en: 英文单词
        context: 上下文句子
    """
    result = await ai.complete_word_entry(word_en, context)
    return result


@router.post("/translate-sentence")
async def translate_long_sentence(
    sentence_en: str,
    ai: AIService = Depends(get_ai)
):
    """
    翻译长难句
    
    Args:
        sentence_en: 英文句子
    """
    result = await ai.translate_long_sentence(sentence_en)
    return result


# ==================== 分句 ====================

@router.post("/split-sentences")
async def split_sentences(
    text: str,
    ai: AIService = Depends(get_ai)
):
    """
    AI分句
    
    Args:
        text: Markdown文本
    """
    result = await ai.split_sentences(text)
    return result


# ==================== 期刊验证 ====================

@router.post("/suggest-journal-correction")
async def suggest_journal_correction(
    journal_name: str,
    ai: AIService = Depends(get_ai)
):
    """
    建议期刊名修正
    
    Args:
        journal_name: 输入的期刊名
    """
    result = await ai.suggest_journal_correction(journal_name)
    return result


# ==================== 术语提取 ====================

@router.post("/extract-terms")
async def extract_terms(
    text: str,
    ai: AIService = Depends(get_ai)
):
    """
    从摘要中提取术语
    
    Args:
        text: 英文摘要
    """
    result = await ai.extract_terms(text)
    return result


# ==================== 文献卡片生成 ====================

@router.post("/generate-card")
async def generate_card(
    literature_data: Dict[str, Any] = Body(...),
    template_prompt: Optional[str] = Body(None),
    ai: AIService = Depends(get_ai)
):
    """
    生成文献卡片
    
    Args:
        literature_data: 文献数据 {title, abstract, journal, etc.}
        template_prompt: 卡片生成提示词模板
    """
    if not template_prompt:
        template_prompt = """Based on the following academic paper information, generate a structured literature card.

Title: {title}
Journal: {journal}
Authors: {authors}
Date: {pubdate}
Abstract: {abstract}

Please provide:
1. Key Contributions (3-5 points)
2. Methodology
3. Limitations
4. Related Work Suggestions

Return the card in Markdown format."""
    
    result = await ai.generate_card(literature_data, template_prompt)
    return result


@router.post("/generate-card-from-template/{template_id}")
async def generate_card_from_template(
    template_id: int,
    doi: str,
    db: Session = Depends(get_db),
    ai: AIService = Depends(get_ai)
):
    """
    使用模板生成文献卡片
    
    Args:
        template_id: 模板ID
        doi: 文献DOI
    """
    from models.literature import LiteratureEntry
    
    # 获取模板
    template = db.query(CardTemplate).filter(CardTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 获取文献数据
    entry = db.query(LiteratureEntry).filter(LiteratureEntry.doi == doi).first()
    if not entry:
        raise HTTPException(status_code=404, detail="文献不存在")
    
    literature_data = {
        "title": entry.title_en or entry.title_cn or "",
        "title_cn": entry.title_cn or "",
        "abstract": entry.abstract_en or entry.abstract_cn or "",
        "abstract_cn": entry.abstract_cn or "",
        "journal": entry.journal or "",
        "authors": entry.author or "",
        "pubdate": entry.pubdate or "",
        "doi": doi
    }
    
    result = await ai.generate_card(literature_data, template.prompt)
    
    if result.get("success"):
        # 保存生成的卡片
        card = LiteratureCard(
            doi=doi,
            title_cn=literature_data.get("title_cn", ""),
            title_en=literature_data.get("title", ""),
            journal=literature_data.get("journal", ""),
            author=literature_data.get("authors", ""),
            pubdate=literature_data.get("pubdate", ""),
            abstract_cn=literature_data.get("abstract_cn", ""),
            abstract_en=literature_data.get("abstract", ""),
            extra_fields={"generated_content": result.get("card_content", "")},
            template_id=template_id
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        
        return {
            "success": True,
            "card": result.get("card_content", ""),
            "card_id": card.doi,
            "usage": result.get("usage")
        }
    
    return result


# ==================== 翻译评价 ====================

@router.post("/evaluate-translation")
async def evaluate_translation(
    original: str = Body(...),
    translation: str = Body(...),
    ai: AIService = Depends(get_ai)
):
    """
    评价翻译质量
    
    Args:
        original: 原文
        translation: 译文
    """
    result = await ai.evaluate_translation(original, translation)
    return result


# ==================== 通用对话 ====================


class ChatRequest(BaseModel):
    messages: List[dict]
    temperature: float = 0.7
    max_tokens: int = 2000

@router.post("/chat")
async def chat(
    request: ChatRequest,
    ai: AIService = Depends(get_ai)
):
    """
    通用聊天接口
    
    Args:
        messages: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
        temperature: 温度参数
        max_tokens: 最大token数
    """
    result = await ai.chat(request.messages, request.temperature, request.max_tokens)
    return result


# ==================== 笔记辅助 ====================

@router.post("/summarize-content")
async def summarize_content(
    content: str,
    max_length: int = Query(default=200, ge=50, le=500),
    ai: AIService = Depends(get_ai)
):
    """
    总结内容
    
    Args:
        content: 内容文本
        max_length: 最大长度
    """
    prompt = f"""请简洁总结以下内容，控制在{max_length}字以内：

{content}

请直接输出总结，不要有其他内容。"""
    
    messages = [
        {"role": "system", "content": "你是一个专业的学术助手，擅长总结文献内容。"},
        {"role": "user", "content": prompt}
    ]
    
    result = await ai.chat(messages, temperature=0.5)
    return result


@router.post("/extract-key-points")
async def extract_key_points(
    content: str,
    num_points: int = Query(default=5, ge=3, le=10),
    ai: AIService = Depends(get_ai)
):
    """
    提取关键点
    
    Args:
        content: 内容文本
        num_points: 关键点数量
    """
    prompt = f"""从以下内容中提取{num_points}个关键点，用JSON格式返回：
{{"points": ["关键点1", "关键点2", ...]}}

内容：
{content}

请只返回JSON，不要有其他文字。"""
    
    messages = [
        {"role": "system", "content": "你是一个专业的学术助手，擅长提取关键信息。"},
        {"role": "user", "content": prompt}
    ]
    
    import json
    result = await ai.chat(messages, temperature=0.3)
    
    if result["success"]:
        try:
            parsed = json.loads(result["content"].strip())
            return {"success": True, "points": parsed.get("points", [])}
        except json.JSONDecodeError:
            return {"success": False, "content": result["content"]}
    
    return result
