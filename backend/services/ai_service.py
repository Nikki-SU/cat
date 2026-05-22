"""
AI 服务 - 翻译和其他AI功能（增强版）
"""
import httpx
import json
import asyncio
import re
from typing import Optional, Dict, Any, List
from config import settings


class AIService:
    """AI 服务（支持OpenAI兼容格式）"""
    
    def __init__(
        self, 
        api_key: str = None, 
        api_base: str = None,
        model: str = "gpt-3.5-turbo"
    ):
        """
        初始化AI服务
        
        Args:
            api_key: API密钥
            api_base: API地址
            model: 模型名称
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.api_base = api_base or settings.OPENAI_API_BASE
        self.model = model
        self.client = httpx.AsyncClient(timeout=120.0)
        self.max_retries = 3
    
    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
    
    async def _request_with_retry(
        self, 
        payload: Dict[str, Any],
        retries: int = None
    ) -> Dict[str, Any]:
        """带重试的请求"""
        retries = retries or self.max_retries
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        for attempt in range(retries):
            try:
                response = await self.client.post(
                    f"{self.api_base}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    return {"success": True, "data": response.json()}
                
                # 速率限制时重试
                if response.status_code == 429 and attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                
                return {
                    "success": False, 
                    "error": f"API请求失败: {response.status_code} - {response.text}"
                }
                
            except httpx.HTTPError as e:
                if attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return {"success": False, "error": f"请求失败: {str(e)}"}
        
        return {"success": False, "error": "重试次数耗尽"}
    
    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            temperature: 温度参数
            max_tokens: 最大token数
            stream: 是否流式响应
            
        Returns:
            响应结果 {success, content, error}
        """
        if not self.api_key:
            return {"success": False, "error": "API密钥未配置"}
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if stream:
            payload["stream"] = True
        
        result = await self._request_with_retry(payload)
        
        if not result["success"]:
            return result
        
        data = result["data"]
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        # Token使用统计
        usage = data.get("usage", {})
        
        return {
            "success": True, 
            "content": content,
            "usage": {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0)
            }
        }
    
    async def translate(self, text: str, target_lang: str = "Chinese") -> Dict[str, Any]:
        """
        翻译文本
        
        Args:
            text: 待翻译文本
            target_lang: 目标语言
            
        Returns:
            翻译结果 {success, translation, error}
        """
        messages = [
            {
                "role": "system",
                "content": f"You are a professional academic translator. Translate the following text to {target_lang}. "
                          f"Maintain the academic tone and preserve any LaTeX formulas or special formatting."
            },
            {
                "role": "user",
                "content": text
            }
        ]
        
        result = await self.chat(messages, temperature=0.3)
        if result["success"]:
            return {"success": True, "translation": result["content"], "usage": result.get("usage")}
        return result
    
    async def translate_title_abstract(self, title: str, abstract: str = None) -> Dict[str, Any]:
        """
        翻译标题和摘要
        
        Args:
            title: 英文标题
            abstract: 英文摘要（可选）
            
        Returns:
            翻译结果 {success, title_cn, abstract_cn, error}
        """
        content_parts = [f"Title: {title}"]
        if abstract:
            content_parts.append(f"Abstract: {abstract[:2000]}")
        
        prompt = f"""Translate the following academic paper metadata to Chinese. 
Return in JSON format with keys 'title_cn' and 'abstract_cn'.

{chr(10).join(content_parts)}

IMPORTANT: 
1. Return ONLY valid JSON, no other text
2. Keep LaTeX formulas unchanged
3. Use academic Chinese terminology"""
        
        messages = [
            {"role": "system", "content": "You are a professional academic translator."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=1500)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "title_cn": parsed.get("title_cn", ""),
                "abstract_cn": parsed.get("abstract_cn", ""),
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def complete_word_entry(
        self, 
        word_en: str, 
        context: str = None
    ) -> Dict[str, Any]:
        """
        补全单词条目信息
        
        Args:
            word_en: 英文单词
            context: 上下文句子
            
        Returns:
            补全结果 {success, word_cn, definition_en, definition_cn, sentence, error}
        """
        context_hint = f"\nContext sentence: {context}" if context else ""
        
        prompt = f"""Complete the following word entry information. Return in JSON format.

Word: {word_en}{context_hint}

Return JSON with keys:
- word_cn: Chinese translation
- definition_en: English definition
- definition_cn: Chinese definition  
- sentence: An example sentence in English

Return ONLY valid JSON, no other text."""
        
        messages = [
            {
                "role": "system",
                "content": "You are an expert in English-Chinese academic translation and vocabulary teaching."
            },
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.5, max_tokens=500)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "word_cn": parsed.get("word_cn", ""),
                "definition_en": parsed.get("definition_en", ""),
                "definition_cn": parsed.get("definition_cn", ""),
                "sentence": parsed.get("sentence", ""),
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def translate_long_sentence(self, sentence_en: str) -> Dict[str, Any]:
        """
        翻译长难句
        
        Args:
            sentence_en: 英文句子
            
        Returns:
            翻译结果 {success, sentence_cn, error}
        """
        messages = [
            {
                "role": "system",
                "content": "You are a professional academic translator. Translate the following sentence to Chinese. "
                          "Maintain the original meaning and academic tone. Preserve any LaTeX formulas."
            },
            {"role": "user", "content": sentence_en}
        ]
        
        result = await self.chat(messages, temperature=0.3)
        if result["success"]:
            return {"success": True, "sentence_cn": result["content"], "usage": result.get("usage")}
        return result
    
    async def split_sentences(self, text: str) -> Dict[str, Any]:
        """
        对文本进行分句
        
        Args:
            text: Markdown文本
            
        Returns:
            分句结果 {success, sentences, error}
        """
        prompt = f"""Split the following academic text into sentences. Return in JSON format.

Text:
{text}

Return JSON with key 'sentences' containing an array of sentence objects:
- text: the sentence text
- is_figure_caption: true if this is a figure/table caption
- is_reference: true if this is a reference citation

Return ONLY valid JSON, no other text."""
        
        messages = [
            {"role": "system", "content": "You are an academic text processing assistant."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.1, max_tokens=3000)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "sentences": parsed.get("sentences", []),
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def suggest_journal_correction(self, journal_name: str) -> Dict[str, Any]:
        """
        建议期刊名修正
        
        Args:
            journal_name: 输入的期刊名
            
        Returns:
            修正建议 {success, suggestion, suggestions, error}
        """
        prompt = f"""Given the possibly misspelled or incomplete journal name '{journal_name}', 
suggest the most likely correct journal name. Consider common abbreviations and variations.

Return JSON with keys:
- suggestion: the most likely correct name
- suggestions: array of 3-5 possible correct names

Return ONLY valid JSON, no other text."""
        
        messages = [
            {"role": "system", "content": "You are an expert in academic journal names."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=500)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "suggestion": parsed.get("suggestion", ""),
                "suggestions": parsed.get("suggestions", []),
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def extract_terms(self, text: str) -> Dict[str, Any]:
        """
        从摘要中提取术语
        
        Args:
            text: 英文摘要
            
        Returns:
            提取结果 {success, terms, error}
        """
        prompt = f"""Extract key terms and their definitions from the following academic abstract.
Return in JSON format.

Abstract:
{text}

Return JSON with key 'terms' containing an array of objects:
- term: the technical term in English
- definition: brief definition in Chinese
- category: 'method', 'concept', or 'tool'

Return ONLY valid JSON, no other text. Limit to 10 most important terms."""
        
        messages = [
            {"role": "system", "content": "You are an expert in academic terminology extraction."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=1000)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "terms": parsed.get("terms", []),
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def generate_card(self, literature_data: Dict[str, Any], template_prompt: str) -> Dict[str, Any]:
        """
        使用模板生成文献卡片
        
        Args:
            literature_data: 文献数据 {title, abstract, journal, etc.}
            template_prompt: 卡片生成提示词模板
            
        Returns:
            生成结果 {success, card, error}
        """
        prompt = template_prompt.format(**literature_data)
        
        messages = [
            {"role": "system", "content": "You are a professional academic literature analyst."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.5, max_tokens=2000)
        
        if not result["success"]:
            return result
        
        return {
            "success": True,
            "card_content": result["content"],
            "usage": result.get("usage")
        }
    
    async def evaluate_translation(
        self, 
        original: str, 
        translation: str
    ) -> Dict[str, Any]:
        """
        评价翻译质量
        
        Args:
            original: 原文
            translation: 译文
            
        Returns:
            评价结果 {success, score, feedback, errors, error_words, error}
        """
        prompt = f"""Evaluate the following translation quality.

Original:
{original}

Translation:
{translation}

Return JSON with:
- score: overall quality score (0-100)
- feedback: detailed feedback in Chinese
- errors: array of error objects with 'original', 'translation', 'type', 'suggestion'
- error_words: array of words that need to be added to vocabulary list

Return ONLY valid JSON, no other text."""
        
        messages = [
            {"role": "system", "content": "You are an expert in academic translation evaluation."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=1500)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "score": parsed.get("score", 0),
                "feedback": parsed.get("feedback", ""),
                "errors": parsed.get("errors", []),
                "error_words": parsed.get("error_words", []),
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def extract_long_sentences(self, markdown: str, doi: str = None) -> Dict[str, Any]:
        """
        从Markdown中提取长难句并翻译
        
        Args:
            markdown: 解析后的Markdown文本
            doi: 文献DOI（可选）
            
        Returns:
            提取结果 {success, sentences: [{sentence_en, sentence_cn, word_count, position}], error}
        """
        prompt = f"""Analyze the following academic paper markdown and extract long, complex sentences.
Focus on sentences that:
1. Have 50+ words
2. Contain complex grammatical structures
3. Express important academic concepts

Return in JSON format:

{{
    "sentences": [
        {{
            "sentence_en": "The original English sentence",
            "word_count": number of words,
            "position": "abstract|introduction|method|result|discussion"
        }}
    ]
}}

IMPORTANT:
1. Return ONLY valid JSON, no other text
2. Extract 5-15 most important long sentences
3. Include sentences from different sections for diversity
4. Preserve complete sentences without truncation

Markdown content (first 8000 chars):
{markdown[:8000]}"""
        
        messages = [
            {"role": "system", "content": "You are an expert at analyzing academic papers and identifying linguistically complex sentences."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=3000)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            sentences = parsed.get("sentences", [])
            
            # 翻译每个长难句
            translated_sentences = []
            for sentence_data in sentences:
                sentence_en = sentence_data.get("sentence_en", "")
                if sentence_en:
                    # 翻译
                    translate_result = await self.translate_long_sentence(sentence_en)
                    translated_sentences.append({
                        "sentence_en": sentence_en,
                        "sentence_cn": translate_result.get("sentence_cn") if translate_result.get("success") else None,
                        "word_count": sentence_data.get("word_count", 0),
                        "position": sentence_data.get("position", "unknown")
                    })
            
            return {
                "success": True,
                "sentences": translated_sentences,
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    async def extract_keywords(self, markdown: str, doi: str = None, count: int = 20) -> Dict[str, Any]:
        """
        从Markdown中提取关键词
        
        Args:
            markdown: 解析后的Markdown文本
            doi: 文献DOI（可选）
            count: 提取数量
            
        Returns:
            提取结果 {success, keywords: [{keyword, translation, frequency, category}], error}
        """
        prompt = f"""Extract key technical keywords and phrases from the following academic paper markdown.
Focus on:
1. Domain-specific technical terms
2. Method names and algorithm names
3. Important concepts and definitions
4. Dataset and model names

Return in JSON format:

{{
    "keywords": [
        {{
            "keyword": "original English term",
            "translation": "Chinese translation",
            "frequency": how many times it appears,
            "category": "method|concept|tool|dataset|model|metric"
        }}
    ]
}}

IMPORTANT:
1. Return ONLY valid JSON, no other text
2. Extract exactly {count} most important keywords
3. Prioritize domain-specific technical terms over common words

Markdown content (first 8000 chars):
{markdown[:8000]}"""
        
        messages = [
            {"role": "system", "content": "You are an expert in academic paper analysis and terminology extraction."},
            {"role": "user", "content": prompt}
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=2000)
        
        if not result["success"]:
            return result
        
        try:
            content = result["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "keywords": parsed.get("keywords", [])[:count],
                "usage": result.get("usage")
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }
    
    def count_tokens(self, text: str) -> int:
        """估算token数量（简单估算）"""
        # 粗略估算：中文约1.5字符/token，英文约4字符/token
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars
        return int(chinese_chars / 1.5 + other_chars / 4)
    
    def estimate_cost(self, prompt_tokens: int, completion_tokens: int) -> Dict[str, float]:
        """估算API调用成本"""
        # 常见模型价格（每1K tokens）
        price_per_1k = {
            "gpt-4": {"prompt": 0.03, "completion": 0.06},
            "gpt-3.5-turbo": {"prompt": 0.0015, "completion": 0.002},
            "gpt-3.5-turbo-16k": {"prompt": 0.003, "completion": 0.004},
        }
        
        model_prices = price_per_1k.get(self.model, {"prompt": 0.001, "completion": 0.002})
        
        prompt_cost = (prompt_tokens / 1000) * model_prices["prompt"]
        completion_cost = (completion_tokens / 1000) * model_prices["completion"]
        
        return {
            "prompt_cost": round(prompt_cost, 6),
            "completion_cost": round(completion_cost, 6),
            "total_cost": round(prompt_cost + completion_cost, 6)
        }


# 全局单例
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """获取AI服务实例"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service


def update_ai_service(api_key: str = None, api_base: str = None, model: str = None):
    """更新AI服务配置"""
    global _ai_service
    _ai_service = AIService(api_key=api_key, api_base=api_base, model=model)
    return _ai_service


async def close_ai_service():
    """关闭AI服务"""
    global _ai_service
    if _ai_service:
        await _ai_service.close()
        _ai_service = None
