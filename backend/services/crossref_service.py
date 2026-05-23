"""
CrossRef API 集成服务 - 增强版
支持 AND/OR/NOT 关键词逻辑过滤
"""
import httpx
import asyncio
import time
import re
from typing import List, Dict, Optional, Any, Tuple
from urllib.parse import quote
from config import settings


class CrossRefService:
    """CrossRef API 服务"""
    
    BASE_URL = "https://api.crossref.org/works"
    EMAIL = settings.CROSSREF_EMAIL
    HEADERS = {
        "User-Agent": f"Mailto:{EMAIL}",
        "Accept": "application/json"
    }
    
    # 速率控制：每秒50请求，但建议使用polite pool降低限制
    RATE_LIMIT_DELAY = 0.1  # 100ms间隔
    _last_request_time = 0
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0, headers=self.HEADERS)
    
    async def _rate_limit(self):
        """速率限制"""
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            await asyncio.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()
    
    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
    
    async def search_by_doi(self, doi: str) -> Optional[Dict[str, Any]]:
        """通过DOI获取文献信息"""
        await self._rate_limit()
        
        try:
            response = await self.client.get(f"{self.BASE_URL}/{doi}")
            if response.status_code == 200:
                data = response.json()
                return self._parse_work(data.get("message", {}))
            elif response.status_code == 404:
                return None
            else:
                response.raise_for_status()
        except httpx.HTTPError as e:
            print(f"CrossRef API error: {e}")
            return None
    
    async def search_by_journal_issn(
        self, 
        issn: str, 
        keywords: List[Dict[str, str]] = None,  # [{word, logic}]
        from_date: str = None,
        until_date: str = None,
        rows: int = 100
    ) -> List[Dict[str, Any]]:
        """
        通过期刊ISSN和关键词搜索文献
        支持 AND/OR/NOT 逻辑过滤
        """
        await self._rate_limit()
        
        params = {
            "issn": issn,
            "rows": min(rows * 3, 1000),  # 多获取一些用于过滤
            "select": "DOI,title,container-title,author,published,abstract,volume,issue,page"
        }
        
        if from_date:
            params["from-pub-date"] = from_date
        if until_date:
            params["until-pub-date"] = until_date
        
        # Step 1: 构建OR查询获取候选文献
        if keywords:
            # 先用OR获取所有可能包含关键词的文献
            or_keywords = [k.get("word", "") for k in keywords if k.get("logic") != "not"]
            if or_keywords:
                keyword_query = " OR ".join([f'"{k}"' for k in or_keywords])
                params["query"] = keyword_query
        
        try:
            response = await self.client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            items = data.get("message", {}).get("items", [])
            
            # 解析所有文献
            results = [self._parse_work(item) for item in items]
            
            # Step 2: 应用 AND/OR/NOT 过滤
            if keywords:
                results = self._filter_by_keywords_logic(results, keywords)
            
            return results[:rows]  # 返回指定数量
            
        except httpx.HTTPError as e:
            print(f"CrossRef API error: {e}")
            return []
    
    def _filter_by_keywords_logic(
        self, 
        works: List[Dict[str, Any]], 
        keywords: List[Dict[str, str]]
    ) -> List[Dict[str, Any]]:
        """
        根据 AND/OR/NOT 逻辑过滤文献
        
        逻辑规则：
        - AND: 文献必须包含所有 AND 关键词
        - OR:  文献包含任一个 OR 关键词（默认）  
        - NOT: 文献排除包含 NOT 关键词的
        
        示例：[{word: "A", logic: "and"}, {word: "B", logic: "or"}, {word: "C", logic: "not"}]
        含义：包含 A AND (B OR ...) AND (NOT C)
        """
        if not keywords:
            return works
        
        # 分离不同逻辑的关键词
        and_keywords = [k.get("word", "").lower() for k in keywords if k.get("logic") == "and"]
        or_keywords = [k.get("word", "").lower() for k in keywords if k.get("logic") in ("or", "")]
        not_keywords = [k.get("word", "").lower() for k in keywords if k.get("logic") == "not"]
        
        filtered = []
        
        for work in works:
            # 获取文献可搜索文本
            searchable_text = self._get_searchable_text(work).lower()
            
            # 检查 AND 条件（必须全部满足）
            and_passed = all(kw in searchable_text for kw in and_keywords)
            
            # 检查 OR 条件（如果没有OR关键词，默认为True）
            if or_keywords:
                or_passed = any(kw in searchable_text for kw in or_keywords)
            else:
                or_passed = True
            
            # 检查 NOT 条件（全部不满足）
            not_passed = not any(kw in searchable_text for kw in not_keywords)
            
            # 只有通过所有条件的文献才保留
            if and_passed and or_passed and not_passed:
                filtered.append(work)
        
        return filtered
    
    def _get_searchable_text(self, work: Dict[str, Any]) -> str:
        """获取文献的可搜索文本（标题+摘要+关键词）"""
        parts = []
        
        # 标题
        title = work.get("title", "") or work.get("title_en", "")
        if title:
            parts.append(title)
        
        # 摘要
        abstract = work.get("abstract", "") or work.get("abstract_en", "")
        if abstract:
            parts.append(abstract)
        
        # 作者
        authors = work.get("authors", [])
        if authors:
            parts.extend(authors)
        
        # 期刊
        journal = work.get("journal", "")
        if journal:
            parts.append(journal)
        
        return " ".join(parts)
    
    async def search_by_journal_name(
        self,
        journal_name: str,
        keywords: List[Dict[str, str]] = None,  # [{word, logic}]
        from_date: str = None,
        until_date: str = None,
        rows: int = 100
    ) -> List[Dict[str, Any]]:
        """
        通过期刊名搜索文献
        支持 AND/OR/NOT 逻辑
        """
        await self._rate_limit()
        
        # 首先获取期刊的ISSN
        issn = await self._get_journal_issn(journal_name)
        if not issn:
            return []
        
        # 使用ISSN搜索
        return await self.search_by_journal_issn(
            issn=issn,
            keywords=keywords,
            from_date=from_date,
            until_date=until_date,
            rows=rows
        )
    
    async def _get_journal_issn(self, journal_name: str) -> Optional[str]:
        """通过期刊名获取ISSN"""
        await self._rate_limit()
        
        params = {
            "query": journal_name,
            "rows": 5
        }
        
        try:
            response = await self.client.get(
                "https://api.crossref.org/journals",
                params=params
            )
            response.raise_for_status()
            data = response.json()
            items = data.get("message", {}).get("items", [])
            
            for item in items:
                titles = item.get("title", [])
                if any(journal_name.lower() in t.lower() for t in titles):
                    issns = item.get("ISSN", [])
                    if issns:
                        return issns[0]
            return None
        except httpx.HTTPError:
            return None
    
    async def validate_journal(self, journal_name: str) -> Dict[str, Any]:
        """验证期刊名称是否有效"""
        await self._rate_limit()
        
        params = {
            "query": journal_name,
            "rows": 10
        }
        
        try:
            response = await self.client.get(
                "https://api.crossref.org/journals",
                params=params
            )
            response.raise_for_status()
            data = response.json()
            items = data.get("message", {}).get("items", [])
            
            if not items:
                return {
                    "valid": False,
                    "suggested_name": None,
                    "article_count": 0,
                    "issn": None
                }
            
            best_match = None
            for item in items:
                titles = item.get("title", [])
                if any(journal_name.lower() == t.lower() for t in titles):
                    best_match = item
                    break
            
            if not best_match and items:
                best_match = items[0]
            
            if best_match:
                titles = best_match.get("title", [])
                issns = best_match.get("ISSN", [])
                return {
                    "valid": True,
                    "suggested_name": titles[0] if titles else journal_name,
                    "article_count": best_match.get("stats", {}).get("articles-total", 0),
                    "issn": issns[0] if issns else None,
                    "is_exact_match": any(journal_name.lower() == t.lower() for t in titles)
                }
            
            return {
                "valid": False,
                "suggested_name": items[0].get("title", [journal_name])[0] if items else None,
                "article_count": 0,
                "issn": None
            }
            
        except httpx.HTTPError as e:
            print(f"CrossRef API error: {e}")
            return {
                "valid": False,
                "suggested_name": None,
                "article_count": 0,
                "issn": None,
                "error": str(e)
            }
    
    def _parse_work(self, work: Dict[str, Any]) -> Dict[str, Any]:
        """解析CrossRef工作条目为统一格式"""
        # 解析作者
        authors = work.get("author", [])
        first_author = None
        communication_author = None
        
        if authors:
            for author in authors:
                if author.get("sequence") == "first":
                    first_author = self._format_author(author)
                    break
            if not first_author and authors:
                first_author = self._format_author(authors[0])
            
            for author in authors:
                if author.get("type") == "senior" or author.get("sequence") == "last":
                    communication_author = self._format_author(author)
                    break
        
        # 解析日期
        published = work.get("published", {})
        date_parts = published.get("date-parts", [[]])
        pub_year = date_parts[0][0] if date_parts and date_parts[0] else None
        pubdate = str(pub_year) if pub_year else None
        
        # 解析容器标题（期刊名）
        container_titles = work.get("container-title", [])
        journal = container_titles[0] if container_titles else None
        
        # 解析ISSN
        issns = work.get("ISSN", [])
        issn = issns[0] if issns else None
        
        # 解析标题
        titles = work.get("title", [])
        title = titles[0] if titles else None
        
        # 解析摘要
        abstract = work.get("abstract", None)
        if abstract:
            abstract = re.sub(r'<[^>]+>', '', abstract)
        
        return {
            "doi": work.get("DOI"),
            "title": title,
            "title_en": title,
            "journal": journal,
            "issn": issn,
            "pubdate": pubdate,
            "abstract": abstract,
            "abstract_en": abstract,
            "abstract_cn": None,
            "volume": work.get("volume"),
            "issue": work.get("issue"),
            "page": work.get("page"),
            "first_author": first_author,
            "communication_author": communication_author,
            "authors": [self._format_author(a) for a in authors],
            "url": f"https://doi.org/{work.get('DOI')}" if work.get("DOI") else None
        }
    
    def _format_author(self, author: Dict[str, Any]) -> str:
        """格式化作者名称"""
        given = author.get("given", "")
        family = author.get("family", "")
        if given and family:
            return f"{family}, {given[0]}."
        return family or given or "Unknown"
    
    async def translate_abstract(self, abstract_en: str) -> Optional[str]:
        """翻译摘要为中文"""
        from services.ai_service import get_ai_service
        
        if not abstract_en:
            return None
        
        try:
            ai_service = get_ai_service()
            result = await ai_service.translate(abstract_en, target_lang="Chinese")
            if result.get("success"):
                return result.get("translation")
        except Exception as e:
            print(f"Abstract translation error: {e}")
        
        return None
    
    async def search_and_translate_abstract(self, doi: str, translate_abstract: bool = True) -> Optional[Dict[str, Any]]:
        """通过DOI获取文献信息，并可选翻译摘要"""
        result = await self.search_by_doi(doi)
        
        if result and translate_abstract and result.get("abstract_en"):
            abstract_cn = await self.translate_abstract(result["abstract_en"])
            if abstract_cn:
                result["abstract_cn"] = abstract_cn
        
        return result


# 全局单例
_crossref_service: Optional[CrossRefService] = None


def get_crossref_service() -> CrossRefService:
    """获取CrossRef服务实例"""
    global _crossref_service
    if _crossref_service is None:
        _crossref_service = CrossRefService()
    return _crossref_service


async def close_crossref_service():
    """关闭CrossRef服务"""
    global _crossref_service
    if _crossref_service:
        await _crossref_service.close()
        _crossref_service = None
