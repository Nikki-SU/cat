"""配对码相关API路由"""
from fastapi import APIRouter, HTTPException, Query, Body, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any

from services.pairing import pairing_manager
from services.relay_client import relay_client
from services.hub_manager import HubManager

router = APIRouter(prefix="/pairing", tags=["设备配对"])


class LeafInfo(BaseModel):
    """Leaf设备信息"""
    device_name: Optional[str] = None
    device_type: Optional[str] = None


@router.post("/generate")
async def generate_pairing_code():
    """Hub生成配对码"""
    hm = HubManager()
    device_id = hm.get_device_id()
    device_name = hm.get_device_name()
    
    hub_info = {
        "device_name": device_name,
        "device_id": device_id,
    }
    
    # 如果配置了中继，加入中继信息
    if relay_client.is_configured():
        hub_info["relay_url"] = relay_client.relay_url
    
    result = pairing_manager.generate_code(device_id, hub_info)
    
    # 如果配置了中继，也注册到中继
    if relay_client.is_configured():
        try:
            await relay_client.register_code(
                code=result["code"],
                psk=result["psk"],
                hub_info=hub_info,
                expires_at=result["expires_at"]
            )
        except Exception as e:
            # 中继注册失败不影响本地配对码
            print(f"Warning: Failed to register code to relay: {e}")
    
    return result


@router.post("/verify")
async def verify_pairing_code(code: str = Query(..., min_length=6, max_length=6)):
    """Leaf验证配对码（不消费，只检查是否有效）"""
    # 先尝试通过中继验证
    if relay_client.is_configured():
        try:
            result = await relay_client.pair_with_code(code, {"type": "verify"})
            return {
                "valid": True,
                "hub_device_id": result.get("hub_info", {}).get("device_id"),
                "hub_info": result.get("hub_info"),
                "via_relay": True
            }
        except Exception:
            pass
    
    # 本地验证
    result = pairing_manager.verify_code(code)
    if not result:
        raise HTTPException(status_code=400, detail="配对码无效或已过期")
    
    # 不暴露PSK给验证接口
    return {
        "valid": True,
        "hub_device_id": result["hub_device_id"],
        "hub_info": {k: v for k, v in result["hub_info"].items() if k != "psk"},
        "via_relay": False
    }


@router.post("/connect")
async def connect_with_pairing_code(code: str = Query(..., min_length=6, max_length=6), leaf_info: Optional[LeafInfo] = None):
    """Leaf使用配对码连接Hub（消费配对码）"""
    # 先尝试通过中继连接
    if relay_client.is_configured():
        try:
            leaf_device_info = {
                "type": "connect",
                "device_name": leaf_info.device_name if leaf_info else None,
                "device_type": leaf_info.device_type if leaf_info else None
            }
            result = await relay_client.pair_with_code(code, leaf_device_info)
            return {
                "success": True,
                "hub_device_id": result.get("hub_info", {}).get("device_id"),
                "psk": result.get("psk"),
                "hub_info": result.get("hub_info"),
                "via_relay": True
            }
        except Exception:
            pass
    
    # 本地验证
    result = pairing_manager.consume_code(code)
    if not result:
        raise HTTPException(status_code=400, detail="配对码无效或已过期")
    
    # 返回Hub完整信息（包括PSK用于加密通信）
    return {
        "success": True,
        "hub_device_id": result["hub_device_id"],
        "psk": result["psk"],
        "hub_info": result["hub_info"],
        "via_relay": False
    }


@router.post("/relay-configure")
async def configure_relay(url: str = Query(...)):
    """配置中继服务器地址"""
    if url:
        relay_client.set_relay(url)
    else:
        relay_client.set_relay(None)
    return {"success": True, "relay_url": relay_client.relay_url}


@router.get("/relay-status")
async def get_relay_status():
    """获取中继连接状态"""
    health = await relay_client.health_check()
    return {
        "configured": relay_client.is_configured(),
        "connected": relay_client.is_connected(),
        "relay_url": relay_client.relay_url,
        "health": health
    }


@router.post("/relay-connect")
async def relay_connect():
    """建立中继连接（Hub调用）"""
    if not relay_client.is_configured():
        raise HTTPException(status_code=400, detail="未配置中继服务器")
    
    hm = HubManager()
    # 从设置中获取PSK（如果有的话）
    psk = None  # TODO: 从设置或配对码中获取
    
    try:
        result = await relay_client.connect(
            device_id=hm.get_device_id(),
            psk=psk or "default"
        )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"连接中继失败: {str(e)}")
