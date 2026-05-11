"""
MinerU API 集成服务
用于PDF/DOC等文档解析为Markdown
"""
import httpx
import asyncio
import os
import re
import time
from typing import Optional, Dict, Any
from config import settings


class MinerUService:
    """MinerU 文档解析服务"""
    
    # MinerU REST API 端点
    API_BASE = "https://mineru.net/api/v1/agent"
    
    def __init__(self, api_token: str = None):
        """
        初始化 MinerU 服务
        
        Args:
            api_token: MinerU API Token（可选，不提供则使用免费Flash模式）
        """
        self.api_token = api_token or settings.MINERU_API_TOKEN
        self.client = httpx.AsyncClient(timeout=120.0)
    
    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
    
    async def extract_from_file(self, file_path: str, mode: str = "auto") -> Dict[str, Any]:
        """
        从本地文件提取内容
        
        Args:
            file_path: 文件路径
            mode: 提取模式 "flash"（免费免Token，小于10MB/20页）或 "accurate"（需Token，大文件200MB/200页）或 "auto"（自动选择）
            
        Returns:
            提取结果 {success, markdown, error}
        """
        if not os.path.exists(file_path):
            return {"success": False, "error": "文件不存在"}
        
        file_size = os.path.getsize(file_path)
        
        # 自动选择模式
        if mode == "auto":
            if self.api_token and file_size > 10 * 1024 * 1024:  # > 10MB
                mode = "accurate"
            else:
                mode = "flash"
        
        try:
            # 尝试使用SDK方式
            if mode == "accurate" or (mode == "auto" and self.api_token and file_size <= 200 * 1024 * 1024):
                return await self._extract_with_sdk(file_path)
            else:
                return await self._extract_with_rest_api(file_path, mode)
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _extract_with_sdk(self, file_path: str) -> Dict[str, Any]:
        """
        使用MinerU SDK提取内容
        
        需要安装: pip install mineru-open-sdk
        """
        try:
            # 动态导入，避免在没有安装时失败
            from mineru import MinerU
            
            client = MinerU(api_token=self.api_token)
            
            # 根据文件大小选择模式
            file_size = os.path.getsize(file_path)
            if file_size <= 10 * 1024 * 1024:  # <= 10MB 使用flash模式
                result = client.flash_extract(file_path)
            else:
                result = client.extract(file_path)
            
            markdown = result.markdown if hasattr(result, 'markdown') else str(result)
            
            return {
                "success": True,
                "markdown": self._clean_markdown(markdown),
                "mode": "sdk"
            }
        except ImportError:
            # SDK未安装，使用REST API
            return await self._extract_with_rest_api(file_path, "accurate")
        except Exception as e:
            return {"success": False, "error": f"SDK提取失败: {str(e)}"}
    
    async def _extract_with_rest_api(self, file_path: str, mode: str = "flash") -> Dict[str, Any]:
        """
        使用MinerU REST API提取内容
        """
        # 准备文件
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        files = {"file": (os.path.basename(file_path), file_content)}
        data = {"mode": mode}
        
        headers = {}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        
        try:
            # 1. 提交解析任务
            submit_response = await self.client.post(
                f"{self.API_BASE}/parse/file",
                files=files,
                data=data,
                headers=headers
            )
            
            if submit_response.status_code != 200:
                return {"success": False, "error": f"提交任务失败: {submit_response.status_code}"}
            
            result = submit_response.json()
            task_id = result.get("task_id")
            
            if not task_id:
                return {"success": False, "error": "未获取到任务ID"}
            
            # 2. 轮询获取结果（最多30次，每次等待2秒）
            for i in range(30):
                await asyncio.sleep(2)
                
                status_response = await self.client.get(
                    f"{self.API_BASE}/parse/result/{task_id}",
                    headers=headers
                )
                
                if status_response.status_code != 200:
                    continue
                
                status_result = status_response.json()
                status = status_result.get("status")
                
                if status == "completed":
                    markdown = status_result.get("markdown", "")
                    return {
                        "success": True,
                        "markdown": self._clean_markdown(markdown),
                        "mode": "rest_api"
                    }
                elif status == "failed":
                    return {"success": False, "error": status_result.get("error", "解析失败")}
            
            return {"success": False, "error": "解析超时"}
            
        except httpx.HTTPError as e:
            return {"success": False, "error": f"API请求失败: {str(e)}"}
    
    def _clean_markdown(self, markdown: str) -> str:
        """
        清理Markdown内容
        
        - 去除页眉页脚
        - 保留图片和公式
        - 保留引用但默认折叠
        """
        if not markdown:
            return ""
        
        lines = markdown.split("\n")
        cleaned_lines = []
        skip_next = False
        
        for i, line in enumerate(lines):
            # 跳过页眉页脚（通常是页码或期刊信息）
            if self._is_header_footer(line):
                continue
            
            # 处理引用块 - 用HTML details包裹
            if line.strip().startswith(">"):
                cleaned_lines.append(self._wrap_reference_block_start())
                cleaned_lines.append(line)
                # 收集后续引用行
                while i + 1 < len(lines) and lines[i + 1].strip().startswith(">"):
                    i += 1
                    cleaned_lines.append(lines[i])
                cleaned_lines.append("</details>")
                continue
            
            cleaned_lines.append(line)
        
        return "\n".join(cleaned_lines)
    
    def _is_header_footer(self, line: str) -> bool:
        """判断是否为页眉页脚"""
        line = line.strip()
        
        # 跳过空行
        if not line:
            return False
        
        # 跳过常见页码格式
        if re.match(r"^\d+$", line):  # 纯数字页码
            return True
        
        # 跳过常见期刊缩写形式的页眉
        header_keywords = ["doi:", "journal", "volume", "issue"]
        if any(kw in line.lower() for kw in header_keywords) and len(line) < 100:
            return True
        
        return False
    
    def _wrap_reference_block_start(self) -> str:
        """生成引用块开始标签"""
        return '<details class="reference-block"><summary>参考文献（点击展开）</summary>\n'


# 全局单例
_mineru_service: Optional[MinerUService] = None


def get_mineru_service() -> MinerUService:
    """获取MinerU服务实例"""
    global _mineru_service
    if _mineru_service is None:
        _mineru_service = MinerUService()
    return _mineru_service


async def close_mineru_service():
    """关闭MinerU服务"""
    global _mineru_service
    if _mineru_service:
        await _mineru_service.close()
        _mineru_service = None
