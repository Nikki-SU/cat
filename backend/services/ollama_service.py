"""
Ollama 本地模型服务
用于翻译、解析等AI功能（替代OpenAI等在线API）
"""
import json
import httpx
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass
import os


@dataclass
class OllamaConfig:
    """Ollama配置"""
    base_url: str = "http://localhost:11434"
    model: str = "llama3:8b"
    temperature: float = 0.7
    max_tokens: int = 2048


class OllamaService:
    """Ollama本地模型服务"""

    def __init__(self, config: Optional[OllamaConfig] = None):
        self.config = config or OllamaConfig()
        self.client = httpx.AsyncClient(timeout=120.0)

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False
    ) -> str:
        """对话接口"""
        url = f"{self.config.base_url}/api/chat"

        payload = {
            "model": self.config.model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature or self.config.temperature,
                "num_predict": max_tokens or self.config.max_tokens,
            }
        }

        if stream:
            return await self._chat_stream(url, payload)
        else:
            return await self._chat_complete(url, payload)

    async def _chat_complete(self, url: str, payload: Dict) -> str:
        """非流式对话"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")

    async def _chat_stream(self, url: str, payload: Dict) -> AsyncGenerator[str, None]:
        """流式对话"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "message" in data:
                                yield data["message"].get("content", "")
                        except json.JSONDecodeError:
                            continue

    async def generate(self, prompt: str, **kwargs) -> str:
        """生成接口（简化版）"""
        messages = [{"role": "user", "content": prompt}]
        return await self.chat(messages, **kwargs)

    # ============ 翻译功能 ============

    async def translate_text(self, text: str, target_lang: str = "zh") -> str:
        """翻译文本"""
        lang_name = "中文" if target_lang == "zh" else "English"
        prompt = f"""请将以下文本翻译成{lang_name}，只返回翻译结果，不要解释：

{text}"""
        return await self.generate(prompt, temperature=0.3)

    async def translate_sentence(self, sentence_en: str) -> str:
        """翻译长难句"""
        prompt = f"""请将以下英文句子翻译成中文，保持句子结构和学术严谨性：

{sentence_en}

请提供：
1. 直译（保持英文语序）
2. 意译（更符合中文表达习惯）

格式：
直译：...
意译：..."""
        return await self.generate(prompt, temperature=0.3)

    # ============ 单词相关 ============

    async def complete_word_info(self, word_en: str, context: Optional[str] = None) -> Dict[str, str]:
        """补全单词信息"""
        ctx = f"\n上下文：{context}" if context else ""
        prompt = f"""请为单词 "{word_en}" 提供以下信息：{ctx}

请以JSON格式返回：
{{
    "word_cn": "中文释义",
    "definition_en": "英文定义",
    "definition_cn": "中文定义",
    "sentence": "例句（英文）"
}}

注意：
- 例句中请包含该单词
- 定义要简洁准确"""

        response = await self.generate(prompt, temperature=0.3)

        # 尝试解析JSON
        try:
            # 尝试从响应中提取JSON
            import re
            json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        # 解析失败，返回空
        return {}

    # ============ 翻译评价 ============

    async def evaluate_translation(
        self,
        original: str,
        translation: str,
        add_to_error_book: bool = True
    ) -> Dict[str, Any]:
        """
        评价翻译质量
        返回：评分、错误分析、建议词汇
        """
        prompt = f"""请评价以下翻译质量，并找出翻译错误：

【原文】
{original}

【用户翻译】
{translation}

请以JSON格式返回：
{{
    "score": 85,  // 0-100分
    "overall_comment": "总体评价",
    "errors": [
        {{
            "original_word": "原文词汇",
            "user_translation": "用户翻译",
            "correct_translation": "正确翻译",
            "explanation": "错误原因",
            "word_en": "对应的英文单词（用于加入生词本）"
        }}
    ],
    "suggestions": ["改进建议1", "改进建议2"],
    "vocabulary_to_learn": ["建议学习的单词1", "建议学习的单词2"]  // 翻译错误的词
}}

注意：
- 只返回JSON，不要有其他内容
- 找出具体的翻译错误（词级别）
- vocabulary_to_learn中的单词应该是用户翻译错误的实词"""

        response = await self.generate(prompt, temperature=0.3)

        try:
            import re
            # 尝试提取JSON
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                result = json.loads(json_match.group())
                return result
        except Exception as e:
            print(f"Parse evaluation error: {e}")

        # 解析失败，返回默认结果
        return {
            "score": 0,
            "overall_comment": "评价解析失败",
            "errors": [],
            "suggestions": ["请重试"],
            "vocabulary_to_learn": []
        }

    # ============ 文献解析 ============

    async def extract_key_points(self, text: str, num_points: int = 5) -> List[str]:
        """提取文献关键点"""
        prompt = f"""请从以下学术文本中提取{num_points}个关键点：

{text[:2000]}  // 限制长度

请以JSON数组格式返回关键点列表：
["关键点1", "关键点2", ...]"""

        response = await self.generate(prompt, temperature=0.3)

        try:
            import re
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        return []

    async def summarize_text(self, text: str, max_length: int = 500) -> str:
        """总结文本"""
        prompt = f"""请总结以下文本（不超过{max_length}字）：

{text[:3000]}"""
        return await self.generate(prompt, temperature=0.3)

    # ============ 卡片生成 ============

    async def generate_literature_card(
        self,
        literature_data: Dict[str, Any],
        template_prompt: str
    ) -> Dict[str, Any]:
        """生成文献卡片"""
        prompt = f"""请根据以下文献信息和模板要求，生成文献卡片：

【文献信息】
标题：{literature_data.get('title_en', '')}
摘要：{literature_data.get('abstract_en', '')}

【模板要求】
{template_prompt}

请以JSON格式返回卡片内容：
{{
    "title_cn": "中文标题",
    "abstract_cn": "中文摘要",
    "keywords_cn": ["关键词1", "关键词2"],
    "key_findings": "主要发现",
    "methodology": "研究方法",
    "significance": "研究意义"
}}"""

        response = await self.generate(prompt, temperature=0.5)

        try:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        return {}

    # ============ 健康检查 ============

    async def health_check(self) -> bool:
        """检查Ollama服务是否可用"""
        try:
            url = f"{self.config.base_url}/api/tags"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                return response.status_code == 200
        except:
            return False

    async def list_models(self) -> List[str]:
        """列出可用模型"""
        try:
            url = f"{self.config.base_url}/api/tags"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                data = response.json()
                return [m.get("name", "") for m in data.get("models", [])]
        except:
            return []


# 全局Ollama实例
_ollama_instance: Optional[OllamaService] = None


def get_ollama_service(config: Optional[Dict[str, Any]] = None) -> OllamaService:
    """获取Ollama服务实例（单例）"""
    global _ollama_instance

    if _ollama_instance is None or config:
        cfg = OllamaConfig()
        if config:
            if "base_url" in config:
                cfg.base_url = config["base_url"]
            if "model" in config:
                cfg.model = config["model"]
            if "temperature" in config:
                cfg.temperature = config["temperature"]
            if "max_tokens" in config:
                cfg.max_tokens = config["max_tokens"]
        _ollama_instance = OllamaService(cfg)

    return _ollama_instance


async def reset_ollama_service():
    """重置Ollama服务实例（配置变更后调用）"""
    global _ollama_instance
    _ollama_instance = None
