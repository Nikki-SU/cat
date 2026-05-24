"""笔记公式OCR识别 API 路由 - 代理SimpleTex API"""
import httpx
import os
from fastapi import APIRouter, HTTPException, UploadFile, File
from services.config_service import get_config_service

router = APIRouter(prefix="/notes", tags=["公式OCR"])

SIMPLEXTEX_TURBO_URL = "https://server.simpletex.cn/api/latex_ocr_turbo"
SIMPLEXTEX_STANDARD_URL = "https://server.simpletex.cn/api/latex_ocr"

# 最大图片大小 5MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024


@router.post("/ocr")
async def ocr_formula(
    file: UploadFile = File(...),
    model: str = "turbo"
):
    """
    公式OCR识别 - 代理SimpleTex API
    
    接收图片，转发到SimpleTex进行LaTeX公式识别。
    支持手写、印刷体公式。
    model: "turbo"(轻量模型，更快) 或 "standard"(标准模型，更精确)
    """
    cs = get_config_service()
    app_id = cs.get("ocr", "simpletex_app_id", "")
    app_secret = cs.get("ocr", "simpletex_app_secret", "")
    
    # 读取图片内容
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="图片大小超过5MB限制")
    
    # 选择API端点
    api_url = SIMPLEXTEX_TURBO_URL if model == "turbo" else SIMPLEXTEX_STANDARD_URL
    
    # 构建请求
    files = {"file": (file.filename or "image.png", content, file.content_type or "image/png")}
    headers = {}
    
    # 如果配置了SimpleTex凭证，添加鉴权
    if app_id and app_secret:
        headers["app-id"] = app_id
        headers["app-secret"] = app_secret
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(api_url, files=files, headers=headers)
            
        if response.status_code != 200:
            raise HTTPException(
                status_code=502, 
                detail=f"SimpleTex API返回错误: HTTP {response.status_code}"
            )
        
        result = response.json()
        
        if result.get("status") is True or result.get("status") == 200:
            latex = result.get("res", {}).get("latex", "")
            confidence = result.get("res", {}).get("conf", 0)
            return {
                "success": True,
                "latex": latex,
                "confidence": confidence,
                "request_id": result.get("request_id", ""),
                "model": model
            }
        else:
            # 无凭证时SimpleTex仍可使用（有限额），检查错误信息
            error_msg = result.get("msg", result.get("message", "识别失败"))
            return {
                "success": False,
                "latex": "",
                "error": error_msg,
                "model": model
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="SimpleTex API超时，请稍后重试")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="无法连接SimpleTex API，请检查网络")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR识别失败: {str(e)}")


@router.post("/ocr-config")
async def update_ocr_config(app_id: str = None, app_secret: str = None):
    """更新OCR配置"""
    cs = get_config_service()
    if app_id is not None:
        cs.set("ocr", "simpletex_app_id", app_id)
    if app_secret is not None:
        cs.set("ocr", "simpletex_app_secret", app_secret)
    return {"success": True, "message": "OCR配置已更新"}


@router.get("/ocr-config")
async def get_ocr_config():
    """获取OCR配置（敏感信息脱敏）"""
    cs = get_config_service()
    app_id = cs.get("ocr", "simpletex_app_id", "")
    app_secret = cs.get("ocr", "simpletex_app_secret", "")
    return {
        "has_config": bool(app_id and app_secret),
        "app_id_set": bool(app_id),
        "app_id_preview": f"***{app_id[-4:]}" if len(app_id) > 4 else ("已设置" if app_id else "未设置"),
        "app_secret_set": bool(app_secret),
        "app_secret_preview": f"***{app_secret[-4:]}" if len(app_secret) > 4 else ("已设置" if app_secret else "未设置")
    }
