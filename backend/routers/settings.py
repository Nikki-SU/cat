"""
设置相关 API 路由
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from database import get_db
from config import settings

router = APIRouter(prefix="/settings", tags=["设置"])


class MinerUConfig(BaseModel):
    """MinerU配置"""
    api_token: Optional[str] = None
    model_version: str = "vlm"
    language: str = "en"


class MinerUConfigResponse(BaseModel):
    """MinerU配置响应"""
    has_token: bool
    model_version: str
    language: str


class AiConfig(BaseModel):
    """AI配置"""
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: Optional[str] = None


# 存储配置（内存中，生产环境应持久化）
_ai_config = {
    "api_key": None,
    "api_base": None,
    "model": None
}

_mineru_config = {
    "api_token": None,
    "model_version": "vlm",
    "language": "en"
}


def _load_configs():
    """从环境变量加载配置"""
    global _ai_config, _mineru_config
    
    _ai_config["api_key"] = os.getenv("OPENAI_API_KEY")
    _ai_config["api_base"] = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    _ai_config["model"] = os.getenv("AI_MODEL", "gpt-3.5-turbo")
    
    _mineru_config["api_token"] = os.getenv("MINERU_API_TOKEN")
    _mineru_config["model_version"] = os.getenv("MINERU_MODEL_VERSION", "vlm")
    _mineru_config["language"] = os.getenv("MINERU_LANGUAGE", "en")


# 初始化加载
_load_configs()


# ==================== AI 配置 ====================

@router.get("/ai-config")
def get_ai_config():
    """获取AI配置"""
    return {
        "api_key_set": bool(_ai_config["api_key"]),
        "api_base": _ai_config["api_base"],
        "model": _ai_config["model"]
    }


@router.post("/ai-config")
def update_ai_config(config: AiConfig):
    """更新AI配置"""
    if config.api_key is not None:
        _ai_config["api_key"] = config.api_key
    if config.api_base is not None:
        _ai_config["api_base"] = config.api_base
    if config.model is not None:
        _ai_config["model"] = config.model
    
    return {"success": True, "message": "AI配置已更新"}


# ==================== MinerU 配置 ====================

@router.get("/mineru-config", response_model=MinerUConfigResponse)
def get_mineru_config():
    """获取MinerU配置"""
    return MinerUConfigResponse(
        has_token=bool(_mineru_config["api_token"]),
        model_version=_mineru_config["model_version"],
        language=_mineru_config["language"]
    )


@router.post("/mineru-config")
def update_mineru_config(config: MinerUConfig):
    """更新MinerU配置"""
    if config.api_token is not None:
        _mineru_config["api_token"] = config.api_token
    if config.model_version is not None:
        _mineru_config["model_version"] = config.model_version
    if config.language is not None:
        _mineru_config["language"] = config.language
    
    return {"success": True, "message": "MinerU配置已更新"}


@router.post("/mineru-token")
def update_mineru_token(token: str):
    """更新MinerU API Token"""
    if not token:
        raise HTTPException(status_code=400, detail="Token不能为空")
    
    _mineru_config["api_token"] = token
    return {"success": True, "message": "MinerU Token已更新"}


@router.get("/mineru-token-status")
def check_mineru_token_status():
    """检查MinerU Token状态"""
    has_token = bool(_mineru_config["api_token"])
    return {
        "has_token": has_token,
        "message": "Token已设置" if has_token else "请先设置Token"
    }


def get_mineru_config_value(key: str, default=None):
    """获取MinerU配置值"""
    return _mineru_config.get(key, default)


def get_ai_config_value(key: str, default=None):
    """获取AI配置值"""
    return _ai_config.get(key, default)
