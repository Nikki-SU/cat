"""
MinerU API 集成服务 - 基于官方API文档
支持 Precision Extract API（需Token）和 Agent Lightweight API（免Token）
"""
import httpx
import asyncio
import os
import re
import time
import zipfile
import tempfile
from typing import Optional, Dict, Any
from pathlib import Path

from config import settings


class MinerUService:
    """MinerU 文档解析服务 - 基于官方API"""
    
    # API Base URLs
    PRECISION_BASE = "https://mineru.net/api/v4"
    AGENT_BASE = "https://mineru.net/api/v1/agent"
    
    def __init__(self, api_token: str = None):
        """
        初始化 MinerU 服务
        
        Args:
            api_token: MinerU API Token（可选，不提供则使用Agent轻量API）
        """
        self.api_token = api_token or settings.MINERU_API_TOKEN
        self.model_version = settings.MINERU_MODEL_VERSION
        self.language = settings.MINERU_LANGUAGE
        self.client = httpx.AsyncClient(timeout=300.0)
    
    def _get_headers(self) -> dict:
        """获取请求头"""
        headers = {}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers
    
    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
    
    # ===== Precision API (需Token) =====
    
    async def extract_by_url(self, url: str, model_version: str = "vlm",
                            enable_formula: bool = True, enable_table: bool = True,
                            language: str = "en", is_ocr: bool = False, 
                            data_id: str = None, extra_formats: list = None,
                            page_ranges: str = None) -> dict:
        """
        通过URL提交解析任务（单文件）
        
        POST /api/v4/extract/task
        
        Returns:
            {"success": True, "task_id": "xxx"}
        """
        if not self.api_token:
            return {"success": False, "error": "需要API Token才能使用Precision API"}
        
        headers = self._get_headers()
        headers["Content-Type"] = "application/json"
        
        data = {
            "url": url,
            "model_version": model_version,
            "enable_formula": enable_formula,
            "enable_table": enable_table,
            "language": language,
            "is_ocr": is_ocr
        }
        
        if data_id:
            data["data_id"] = data_id
        if extra_formats:
            data["extra_formats"] = extra_formats
        if page_ranges:
            data["page_ranges"] = page_ranges
        
        try:
            response = await self.client.post(
                f"{self.PRECISION_BASE}/extract/task",
                headers=headers,
                json=data
            )
            
            result = response.json()
            
            if result.get("code") == 0:
                return {"success": True, "task_id": result["data"]["task_id"]}
            else:
                return {"success": False, "error": result.get("msg", "未知错误")}
                
        except httpx.HTTPError as e:
            return {"success": False, "error": f"API请求失败: {str(e)}"}
    
    async def extract_by_file(self, file_path: str, model_version: str = "vlm",
                             enable_formula: bool = True, enable_table: bool = True,
                             language: str = "en", is_ocr: bool = False,
                             data_id: str = None, extra_formats: list = None) -> dict:
        """
        通过本地文件上传解析
        
        1. POST /api/v4/file-urls/batch 获取上传URL
        2. PUT 上传文件
        3. 返回 batch_id
        
        Returns:
            {"success": True, "batch_id": "xxx"}
        """
        if not self.api_token:
            return {"success": False, "error": "需要API Token才能使用Precision API"}
        
        if not os.path.exists(file_path):
            return {"success": False, "error": "文件不存在"}
        
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        # 限制200MB
        if file_size > 200 * 1024 * 1024:
            return {"success": False, "error": "文件大小超过200MB限制"}
        
        headers = self._get_headers()
        headers["Content-Type"] = "application/json"
        
        # 1. 获取上传URL
        files_data = [{
            "name": file_name,
            "data_id": data_id or file_name
        }]
        
        data = {
            "files": files_data,
            "model_version": model_version,
            "enable_formula": enable_formula,
            "enable_table": enable_table,
            "language": language
        }
        
        if extra_formats:
            data["extra_formats"] = extra_formats
        
        try:
            response = await self.client.post(
                f"{self.PRECISION_BASE}/file-urls/batch",
                headers=headers,
                json=data
            )
            
            result = response.json()
            
            if result.get("code") != 0:
                return {"success": False, "error": result.get("msg", "获取上传URL失败")}
            
            batch_id = result["data"]["batch_id"]
            file_urls = result["data"]["file_urls"]
            
            if not file_urls:
                return {"success": False, "error": "未获取到上传URL"}
            
            # 2. 上传文件（不需要Content-Type头）
            with open(file_path, "rb") as f:
                upload_response = await self.client.put(
                    file_urls[0],
                    content=f.read()
                )
            
            if upload_response.status_code not in (200, 201):
                return {"success": False, "error": f"文件上传失败: {upload_response.status_code}"}
            
            return {"success": True, "batch_id": batch_id}
            
        except httpx.HTTPError as e:
            return {"success": False, "error": f"API请求失败: {str(e)}"}
    
    async def get_task_result(self, task_id: str) -> dict:
        """
        查询单文件任务结果
        
        GET /api/v4/extract/task/{task_id}
        
        Returns:
            {"state": "done/pending/running/failed", "full_zip_url": "xxx", ...}
        """
        headers = self._get_headers()
        
        try:
            response = await self.client.get(
                f"{self.PRECISION_BASE}/extract/task/{task_id}",
                headers=headers
            )
            
            result = response.json()
            
            if result.get("code") == 0:
                return result["data"]
            else:
                return {"state": "failed", "error": result.get("msg", "查询失败")}
                
        except httpx.HTTPError as e:
            return {"state": "failed", "error": f"API请求失败: {str(e)}"}
    
    async def get_batch_result(self, batch_id: str) -> dict:
        """
        查询批量任务结果
        
        GET /api/v4/extract/task/batch/{batch_id}
        """
        headers = self._get_headers()
        
        try:
            response = await self.client.get(
                f"{self.PRECISION_BASE}/extract/task/batch/{batch_id}",
                headers=headers
            )
            
            result = response.json()
            
            if result.get("code") == 0:
                return result["data"]
            else:
                return {"state": "failed", "error": result.get("msg", "查询失败")}
                
        except httpx.HTTPError as e:
            return {"state": "failed", "error": f"API请求失败: {str(e)}"}
    
    async def poll_until_done(self, task_id: str = None, batch_id: str = None,
                              timeout: int = 300, interval: int = 5) -> dict:
        """
        轮询直到完成，返回结果
        
        完成时下载zip，提取full.md内容
        
        Returns:
            {"success": True, "markdown": "...", "zip_url": "..."}
        """
        start_time = time.time()
        last_state = None
        
        while time.time() - start_time < timeout:
            if batch_id:
                result = await self.get_batch_result(batch_id)
                extract_results = result.get("extract_result", [])
                if extract_results:
                    result = extract_results[0]
                state = result.get("state", "pending")
            else:
                result = await self.get_task_result(task_id)
                state = result.get("state", "pending")
                zip_url = result.get("full_zip_url")
            
            if state != last_state:
                print(f"[MinerU] Task state: {state}")
                last_state = state
            
            if state == "done":
                zip_url = result.get("full_zip_url")
                if zip_url:
                    try:
                        markdown = await self._download_and_extract_markdown(zip_url)
                        return {
                            "success": True,
                            "markdown": markdown,
                            "zip_url": zip_url
                        }
                    except Exception as e:
                        return {"success": False, "error": f"下载解析结果失败: {str(e)}"}
                else:
                    return {"success": False, "error": "未获取到结果URL"}
            
            elif state == "failed":
                error_msg = result.get("err_msg", "解析失败")
                return {"success": False, "error": error_msg}
            
            await asyncio.sleep(interval)
        
        return {"success": False, "error": f"轮询超时 ({timeout}s)"}
    
    # ===== Agent Lightweight API (免Token) =====
    
    async def agent_extract_by_url(self, url: str, language: str = "en",
                                   enable_table: bool = True, is_ocr: bool = False,
                                   enable_formula: bool = True, page_range: str = None) -> dict:
        """
        Agent轻量API - URL解析
        
        POST /api/v1/agent/parse/url
        """
        data = {
            "url": url,
            "language": language,
            "enable_table": enable_table,
            "is_ocr": is_ocr,
            "enable_formula": enable_formula
        }
        
        if page_range:
            data["page_range"] = page_range
        
        try:
            response = await self.client.post(
                f"{self.AGENT_BASE}/parse/url",
                json=data
            )
            
            result = response.json()
            
            if result.get("code") == 0:
                return {"success": True, "task_id": result["data"]["task_id"]}
            else:
                return {"success": False, "error": result.get("msg", "提交任务失败")}
                
        except httpx.HTTPError as e:
            return {"success": False, "error": f"API请求失败: {str(e)}"}
    
    async def agent_extract_by_file(self, file_path: str, language: str = "en",
                                   enable_table: bool = True, is_ocr: bool = False,
                                   enable_formula: bool = True, page_range: str = None) -> dict:
        """
        Agent轻量API - 文件上传
        
        1. POST /api/v1/agent/parse/file 获取签名URL
        2. PUT上传文件
        """
        if not os.path.exists(file_path):
            return {"success": False, "error": "文件不存在"}
        
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        
        # 限制10MB
        if file_size > 10 * 1024 * 1024:
            return {"success": False, "error": "文件大小超过10MB限制（Agent轻量API限制）"}
        
        # 1. 获取签名上传URL
        data = {
            "file_name": file_name,
            "language": language,
            "enable_table": enable_table,
            "is_ocr": is_ocr,
            "enable_formula": enable_formula
        }
        
        if page_range:
            data["page_range"] = page_range
        
        try:
            response = await self.client.post(
                f"{self.AGENT_BASE}/parse/file",
                json=data
            )
            
            result = response.json()
            
            if result.get("code") != 0:
                return {"success": False, "error": result.get("msg", "获取上传URL失败")}
            
            task_id = result["data"]["task_id"]
            file_url = result["data"]["file_url"]
            
            # 2. PUT上传文件
            with open(file_path, "rb") as f:
                upload_response = await self.client.put(
                    file_url,
                    content=f.read()
                )
            
            if upload_response.status_code not in (200, 201):
                return {"success": False, "error": f"文件上传失败: {upload_response.status_code}"}
            
            return {"success": True, "task_id": task_id}
            
        except httpx.HTTPError as e:
            return {"success": False, "error": f"API请求失败: {str(e)}"}
    
    async def agent_get_result(self, task_id: str) -> dict:
        """
        Agent API查询结果
        
        GET /api/v1/agent/parse/{task_id}
        """
        try:
            response = await self.client.get(
                f"{self.AGENT_BASE}/parse/{task_id}"
            )
            
            result = response.json()
            
            if result.get("code") == 0:
                return result["data"]
            else:
                return {"state": "failed", "error": result.get("msg", "查询失败")}
                
        except httpx.HTTPError as e:
            return {"state": "failed", "error": f"API请求失败: {str(e)}"}
    
    async def agent_poll_until_done(self, task_id: str, 
                                    timeout: int = 300, interval: int = 3) -> dict:
        """
        Agent API轮询直到完成
        
        完成时下载markdown_url的内容
        
        Returns:
            {"success": True, "markdown": "..."}
        """
        start_time = time.time()
        last_state = None
        
        while time.time() - start_time < timeout:
            result = await self.agent_get_result(task_id)
            state = result.get("state", "pending")
            
            if state != last_state:
                print(f"[MinerU Agent] Task state: {state}")
                last_state = state
            
            if state == "done":
                markdown_url = result.get("markdown_url")
                if markdown_url:
                    try:
                        # 下载markdown内容
                        md_response = await self.client.get(markdown_url)
                        markdown = md_response.text
                        return {
                            "success": True,
                            "markdown": markdown
                        }
                    except Exception as e:
                        return {"success": False, "error": f"下载Markdown失败: {str(e)}"}
                else:
                    return {"success": False, "error": "未获取到Markdown URL"}
            
            elif state == "failed":
                error_msg = result.get("err_msg", "解析失败")
                error_code = result.get("err_code")
                
                # 提供更友好的错误信息
                error_messages = {
                    -30001: "文件大小超过10MB限制，请使用Precision API",
                    -30002: "不支持的文件类型，请上传PDF/Image/Doc/PPT/Excel",
                    -30003: "文件页数超过20页限制，请使用Precision API或指定page_range",
                    -30004: "请求参数错误"
                }
                
                friendly_msg = error_messages.get(error_code, error_msg)
                return {"success": False, "error": friendly_msg}
            
            await asyncio.sleep(interval)
        
        return {"success": False, "error": f"轮询超时 ({timeout}s)"}
    
    # ===== 工具方法 =====
    
    async def _download_and_extract_markdown(self, zip_url: str) -> str:
        """
        下载zip并提取full.md内容
        """
        # 下载zip到临时目录
        with tempfile.TemporaryDirectory() as temp_dir:
            zip_path = os.path.join(temp_dir, "result.zip")
            
            # 下载文件
            response = await self.client.get(zip_url)
            response.raise_for_status()
            
            with open(zip_path, "wb") as f:
                f.write(response.content)
            
            # 解压
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # 查找full.md（可能在子目录中）
            full_md_path = self._find_file(temp_dir, "full.md")
            
            if full_md_path:
                with open(full_md_path, "r", encoding="utf-8") as f:
                    markdown = f.read()
                return self._clean_markdown(markdown)
            else:
                raise FileNotFoundError("未找到full.md文件")
    
    def _find_file(self, directory: str, filename: str) -> str:
        """在目录中递归查找文件"""
        for root, dirs, files in os.walk(directory):
            if filename in files:
                return os.path.join(root, filename)
        return None
    
    def _clean_markdown(self, markdown: str) -> str:
        """
        清理markdown：去页眉页脚，引用块折叠
        """
        if not markdown:
            return ""
        
        lines = markdown.split("\n")
        cleaned_lines = []
        
        for line in lines:
            # 跳过页眉页脚
            if self._is_header_footer(line):
                continue
            
            cleaned_lines.append(line)
        
        result = "\n".join(cleaned_lines)
        
        # 清理多余的空行
        result = re.sub(r"\n{3,}", "\n\n", result)
        
        return result.strip()
    
    def _is_header_footer(self, line: str) -> bool:
        """判断是否为页眉页脚"""
        line = line.strip()
        
        if not line:
            return False
        
        # 跳过纯数字页码
        if re.match(r"^\d+$", line):
            return True
        
        # 跳过常见页码格式
        if re.match(r"^[-–—]\s*\d+\s*[-–—]$", line):
            return True
        
        # 跳过常见期刊缩写形式的页眉
        header_keywords = ["doi:", "journal", "volume", "issue", "pp.", "page"]
        if any(kw in line.lower() for kw in header_keywords) and len(line) < 100:
            return True
        
        return False
    
    # ===== 便捷方法 =====
    
    async def extract(self, source, source_type: str = "file",
                     model_version: str = "vlm", **kwargs) -> dict:
        """
        统一的文档解析入口
        
        Args:
            source: 文件路径或URL
            source_type: "file" 或 "url"
            model_version: "vlm"（推荐）或 "pipeline"
            **kwargs: 其他参数
            
        Returns:
            {"success": True, "markdown": "..."}
        """
        if self.api_token:
            # 使用Precision API
            if source_type == "url":
                result = await self.extract_by_url(source, model_version=model_version, **kwargs)
                if result.get("success"):
                    return await self.poll_until_done(task_id=result["task_id"])
                return result
            else:
                result = await self.extract_by_file(source, model_version=model_version, **kwargs)
                if result.get("success"):
                    return await self.poll_until_done(batch_id=result["batch_id"])
                return result
        else:
            # 使用Agent轻量API
            if source_type == "url":
                result = await self.agent_extract_by_url(source, **kwargs)
                if result.get("success"):
                    return await self.agent_poll_until_done(result["task_id"])
                return result
            else:
                result = await self.agent_extract_by_file(source, **kwargs)
                if result.get("success"):
                    return await self.agent_poll_until_done(result["task_id"])
                return result


# ==================== 全局单例管理 ====================

_mineru_service: Optional[MinerUService] = None


def get_mineru_service(api_token: str = None) -> MinerUService:
    """获取MinerU服务实例"""
    global _mineru_service
    
    if api_token:
        # 如果提供了新的token，重新创建实例
        if _mineru_service:
            # 异步关闭旧实例
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(_mineru_service.close())
                else:
                    loop.run_until_complete(_mineru_service.close())
            except:
                pass
        
        _mineru_service = MinerUService(api_token=api_token)
    elif _mineru_service is None:
        _mineru_service = MinerUService()
    
    return _mineru_service


async def close_mineru_service():
    """关闭MinerU服务"""
    global _mineru_service
    if _mineru_service:
        await _mineru_service.close()
        _mineru_service = None
