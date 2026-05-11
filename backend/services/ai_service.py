"""
AI 服务 - 翻译和其他AI功能
"""
import httpx
import json
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
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
    
    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> Dict[str, Any]:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            temperature: 温度参数
            max_tokens: 最大token数
            
        Returns:
            响应结果 {success, content, error}
        """
        if not self.api_key:
            return {"success": False, "error": "API密钥未配置"}
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            response = await self.client.post(
                f"{self.api_base}/chat/completions",
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                return {
                    "success": False, 
                    "error": f"API请求失败: {response.status_code} - {response.text}"
                }
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            return {"success": True, "content": content}
            
        except httpx.HTTPError as e:
            return {"success": False, "error": f"请求失败: {str(e)}"}
    
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
            return {"success": True, "translation": result["content"]}
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
        content_parts = [
            f"Title: {title}",
        ]
        if abstract:
            content_parts.append(f"Abstract: {abstract[:2000]}")  # 限制摘要长度
        
        prompt = f"""Translate the following academic paper metadata to Chinese. 
Return in JSON format with keys 'title_cn' and 'abstract_cn'.

{chr(10).join(content_parts)}

IMPORTANT: 
1. Return ONLY valid JSON, no other text
2. Keep LaTeX formulas unchanged
3. Use academic Chinese terminology"""
        
        messages = [
            {
                "role": "system", 
                "content": "You are a professional academic translator."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        result = await self.chat(messages, temperature=0.3, max_tokens=1500)
        
        if not result["success"]:
            return result
        
        try:
            # 尝试解析JSON
            content = result["content"].strip()
            # 去除可能的markdown代码块
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            parsed = json.loads(content.strip())
            return {
                "success": True,
                "title_cn": parsed.get("title_cn", ""),
                "abstract_cn": parsed.get("abstract_cn", "")
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
            {
                "role": "user",
                "content": prompt
            }
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
                "sentence": parsed.get("sentence", "")
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
            {
                "role": "user",
                "content": sentence_en
            }
        ]
        
        result = await self.chat(messages, temperature=0.3)
        if result["success"]:
            return {"success": True, "sentence_cn": result["content"]}
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
            {
                "role": "system",
                "content": "You are an academic text processing assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
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
                "sentences": parsed.get("sentences", [])
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
            修正建议 {success, suggestions, error}
        """
        prompt = f"""Given the possibly misspelled or incomplete journal name '{journal_name}', 
suggest 5 correct journal names that might match. Consider common abbreviations and variations.

Return JSON with key 'suggestions' containing an array of possible correct names.
Return ONLY valid JSON, no other text."""
        
        messages = [
            {
                "role": "system",
                "content": "You are an expert in academic journal names."
            },
            {
                "role": "user",
                "content": prompt
            }
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
                "suggestions": parsed.get("suggestions", [])
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "无法解析AI返回的JSON",
                "raw_content": result["content"]
            }


# 全局单例
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """获取AI服务实例"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service


async def close_ai_service():
    """关闭AI服务"""
    global _ai_service
    if _ai_service:
        await _ai_service.close()
        _ai_service = None
