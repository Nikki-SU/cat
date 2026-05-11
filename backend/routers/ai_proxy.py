"""AI 代理相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from services.ai_service import get_ai_service, AIService
from services.crossref_service import get_crossref_service, CrossRefService

router = APIRouter(prefix="/ai", tags=["AI"])


def get_ai() -> AIService:
    return get_ai_service()


def get_crossref() -> CrossRefService:
    return get_crossref_service()


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
    # 获取文献信息
    work = await crossref.search_by_doi(doi)
    if not work:
        raise HTTPException(status_code=404, detail="DOI不存在")
    
    # 翻译
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


# ==================== 通用对话 ====================

@router.post("/chat")
async def chat(
    messages: List[dict],
    temperature: float = Query(default=0.7, ge=0, le=2),
    max_tokens: int = Query(default=2000, ge=100, le=4000),
    ai: AIService = Depends(get_ai)
):
    """
    通用聊天接口
    
    Args:
        messages: 消息列表 [{"role": "user/assistant/system", "content": "..."}]
        temperature: 温度参数
        max_tokens: 最大token数
    """
    result = await ai.chat(messages, temperature, max_tokens)
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
