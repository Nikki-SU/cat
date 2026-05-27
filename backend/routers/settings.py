"""设置相关 API 路由 - 配置持久化到本地JSON文件"""
from fastapi import APIRouter, HTTPException, Path, Query, Body
from pydantic import BaseModel
from typing import Optional, List

from services.config_service import get_config_service

router = APIRouter(prefix="/settings", tags=["设置"])


# ========== Request Models ==========

class MinerUConfig(BaseModel):
    api_token: Optional[str] = None
    model_version: Optional[str] = None
    language: Optional[str] = None

class MinerUConfigResponse(BaseModel):
    has_token: bool
    model_version: str
    language: str

class AiConfig(BaseModel):
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: Optional[str] = None

class AiConfigResponse(BaseModel):
    api_key_set: bool
    api_base: str
    model: str

class TrackingConfig(BaseModel):
    interval: Optional[int] = None
    display_language: Optional[str] = None
    display_detail: Optional[str] = None

class LearningConfig(BaseModel):
    word_queue_length: Optional[int] = None
    allow_skip: Optional[bool] = None
    question_types: Optional[List[str]] = None
    translation_mode: Optional[str] = None
    review_mode: Optional[str] = None

class SearchEngine(BaseModel):
    id: Optional[str] = None
    name: str
    icon: str = "🔍"
    url_template: str
    enabled: bool = True


# ========== AI 配置 ==========

@router.get("/ai-config")
def get_ai_config():
    cs = get_config_service()
    return AiConfigResponse(
        api_key_set=bool(cs.get("ai", "api_key")),
        api_base=cs.get("ai", "api_base", "https://api.openai.com/v1"),
        model=cs.get("ai", "model", "gpt-3.5-turbo")
    )

@router.post("/ai-config")
def update_ai_config(config: AiConfig):
    cs = get_config_service()
    if config.api_key is not None:
        cs.set("ai", "api_key", config.api_key)
    if config.api_base is not None:
        cs.set("ai", "api_base", config.api_base)
    if config.model is not None:
        cs.set("ai", "model", config.model)
    return {"success": True, "message": "AI配置已更新"}


# ========== MinerU 配置 ==========

@router.get("/mineru-config", response_model=MinerUConfigResponse)
def get_mineru_config():
    cs = get_config_service()
    return MinerUConfigResponse(
        has_token=bool(cs.get("mineru", "api_token")),
        model_version=cs.get("mineru", "model_version", "vlm"),
        language=cs.get("mineru", "language", "en")
    )

@router.post("/mineru-config")
def update_mineru_config(config: MinerUConfig):
    cs = get_config_service()
    if config.api_token is not None:
        cs.set("mineru", "api_token", config.api_token)
    if config.model_version is not None:
        cs.set("mineru", "model_version", config.model_version)
    if config.language is not None:
        cs.set("mineru", "language", config.language)
    return {"success": True, "message": "MinerU配置已更新"}

@router.post("/mineru-token")
def update_mineru_token(token: str = Query(...)):
    if not token:
        raise HTTPException(status_code=400, detail="Token不能为空")
    cs = get_config_service()
    cs.set("mineru", "api_token", token)
    return {"success": True, "message": "MinerU Token已更新"}

@router.get("/mineru-token-status")
def check_mineru_token_status():
    cs = get_config_service()
    has_token = bool(cs.get("mineru", "api_token"))
    return {"has_token": has_token, "message": "Token已设置" if has_token else "请先设置Token"}


# ========== 追踪配置 ==========

@router.get("/tracking-config")
def get_tracking_config():
    return get_config_service().get_section("tracking")

@router.post("/tracking-config")
def update_tracking_config(config: TrackingConfig):
    cs = get_config_service()
    data = config.model_dump(exclude_none=True)
    for k, v in data.items():
        cs.set("tracking", k, v)
    return {"success": True, "message": "追踪配置已更新"}


# ========== 学习配置 ==========

@router.get("/learning-config")
def get_learning_config():
    return get_config_service().get_section("learning")

@router.post("/learning-config")
def update_learning_config(config: LearningConfig):
    cs = get_config_service()
    data = config.model_dump(exclude_none=True)
    for k, v in data.items():
        cs.set("learning", k, v)
    return {"success": True, "message": "学习配置已更新"}


# ========== 搜索引擎配置 ==========

@router.get("/search-engines")
def get_search_engines():
    """获取所有搜索引擎"""
    cs = get_config_service()
    return cs.get("search_engines", "engines", [])

@router.post("/search-engines")
def add_search_engine(engine: SearchEngine):
    """添加搜索引擎"""
    cs = get_config_service()
    engines = cs.get("search_engines", "engines", [])
    
    # 验证URL模板
    if "{query}" not in engine.url_template:
        raise HTTPException(status_code=400, detail="URL模板必须包含 {query} 占位符")
    
    # 自动生成ID
    if not engine.id:
        import uuid
        engine.id = str(uuid.uuid4())[:8]
    
    engines.append(engine.model_dump())
    cs.set("search_engines", "engines", engines)
    return {"success": True, "engine": engine.model_dump()}

@router.put("/search-engines/{engine_id}")
def update_search_engine(engine_id: str = Path(...), engine: SearchEngine = Body(...)):
    """更新搜索引擎"""
    cs = get_config_service()
    engines = cs.get("search_engines", "engines", [])
    
    # 验证URL模板
    if "{query}" not in engine.url_template:
        raise HTTPException(status_code=400, detail="URL模板必须包含 {query} 占位符")
    
    for i, e in enumerate(engines):
        if e.get("id") == engine_id:
            engine.id = engine_id
            engines[i] = engine.model_dump()
            cs.set("search_engines", "engines", engines)
            return {"success": True}
    
    raise HTTPException(status_code=404, detail="搜索引擎不存在")

@router.delete("/search-engines/{engine_id}")
def delete_search_engine(engine_id: str = Path(...)):
    """删除搜索引擎"""
    cs = get_config_service()
    engines = cs.get("search_engines", "engines", [])
    engines = [e for e in engines if e.get("id") != engine_id]
    cs.set("search_engines", "engines", engines)
    return {"success": True}

@router.post("/search-engines/reset")
def reset_search_engines():
    """重置为默认搜索引擎"""
    cs = get_config_service()
    from services.config_service import DEFAULT_CONFIG
    cs.set("search_engines", "engines", DEFAULT_CONFIG["search_engines"]["engines"])
    return {"success": True}



# ========== OCR 配置 ==========

class OcrConfig(BaseModel):
    app_id: Optional[str] = None
    app_secret: Optional[str] = None

class OcrConfigResponse(BaseModel):
    has_config: bool
    app_id_set: bool
    app_id_preview: str
    app_secret_set: bool
    app_secret_preview: str

@router.get("/ocr-config", response_model=OcrConfigResponse)
def get_ocr_config():
    cs = get_config_service()
    app_id = cs.get("ocr", "simpletex_app_id", "")
    app_secret = cs.get("ocr", "simpletex_app_secret", "")
    return OcrConfigResponse(
        has_config=bool(app_id and app_secret),
        app_id_set=bool(app_id),
        app_id_preview=f"***{app_id[-4:]}" if len(app_id) > 4 else ("已设置" if app_id else "未设置"),
        app_secret_set=bool(app_secret),
        app_secret_preview=f"***{app_secret[-4:]}" if len(app_secret) > 4 else ("已设置" if app_secret else "未设置")
    )

@router.post("/ocr-config")
def update_ocr_config(config: OcrConfig):
    cs = get_config_service()
    if config.app_id is not None:
        cs.set("ocr", "simpletex_app_id", config.app_id)
    if config.app_secret is not None:
        cs.set("ocr", "simpletex_app_secret", config.app_secret)
    return {"success": True, "message": "OCR配置已更新"}

# ========== 全部配置 ==========

@router.get("/all")
def get_all_config():
    """获取所有配置（敏感信息脱敏）"""
    cs = get_config_service()
    all_config = cs.get_all()
    # 脱敏
    if all_config.get("ai", {}).get("api_key"):
        all_config["ai"]["api_key"] = "***" + all_config["ai"]["api_key"][-4:]
    if all_config.get("mineru", {}).get("api_token"):
        all_config["mineru"]["api_token"] = "***" + all_config["mineru"]["api_token"][-4:]
    if all_config.get("ocr", {}).get("simpletex_app_secret"):
        all_config["ocr"]["simpletex_app_secret"] = "***" + all_config["ocr"]["simpletex_app_secret"][-4:]
    return all_config

@router.post("/reset")
def reset_config():
    """重置配置为默认值"""
    cs = get_config_service()
    from services.config_service import DEFAULT_CONFIG
    cs.set_section("ai", DEFAULT_CONFIG.get("ai", {}))
    cs.set_section("mineru", DEFAULT_CONFIG.get("mineru", {}))
    return {"success": True, "message": "配置已重置"}


# ========== 兼容性：给其他模块调用 ==========

def get_mineru_config_value(key: str, default=None):
    return get_config_service().get("mineru", key, default)

def get_ai_config_value(key: str, default=None):
    return get_config_service().get("ai", key, default)
