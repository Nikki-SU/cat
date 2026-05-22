"""
同步API路由 v2 - Hub/Leaf去中心化同步
替换原有的 sync 路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from database import get_db
from services.sync_engine import create_sync_engine
from services.hub_manager import get_hub_manager, HubManager
from services.discovery import get_scanner, HubScanner, HubInfo
from services.change_tracker import set_current_device_id, clear_current_device_id


router = APIRouter(prefix="/sync", tags=["同步v2"])


# ==================== 请求/响应模型 ====================

class RegisterRequest(BaseModel):
    """设备注册请求"""
    device_id: str
    device_name: str
    device_type: str  # "computer" / "phone" / "tablet"


class HubInfoResponse(BaseModel):
    """Hub信息响应"""
    device_id: str
    device_name: str
    device_type: str
    role: str


class DeviceResponse(BaseModel):
    """设备信息响应"""
    device_id: str
    device_name: str
    device_type: str
    is_online: bool
    last_seen: Optional[str]
    hub_url: Optional[str]


class PushRequest(BaseModel):
    """推送变更请求"""
    device_id: str
    changes: List[Dict[str, Any]]


class PushResponse(BaseModel):
    """推送变更响应"""
    success: bool
    processed: int
    errors: List[Dict[str, Any]]


class PullRequest(BaseModel):
    """拉取变更请求"""
    device_id: str
    since_log_id: int = 0


class PullResponse(BaseModel):
    """拉取变更响应"""
    changes: List[Dict[str, Any]]
    latest_log_id: int
    has_more: bool


class SyncStatusResponse(BaseModel):
    """同步状态响应"""
    device_id: str
    last_sync_log_id: int
    last_sync_time: Optional[str]
    unsynced_changes: int
    total_logs: int


class DiscoverResponse(BaseModel):
    """发现Hub响应"""
    hubs: List[Dict[str, Any]]


class SwitchRoleRequest(BaseModel):
    """切换角色请求"""
    role: str  # "hub" / "leaf"
    hub_url: Optional[str] = None


class SwitchRoleResponse(BaseModel):
    """切换角色响应"""
    success: bool
    old_role: Optional[str]
    new_role: str


# ==================== API 端点 ====================

@router.get("/hub-info", response_model=HubInfoResponse)
def get_hub_info():
    """获取Hub信息（设备发现用）"""
    manager = get_hub_manager()
    return HubInfoResponse(
        device_id=manager.get_device_id(),
        device_name=manager.get_device_name(),
        device_type=manager.get_device_type(),
        role=manager.get_role() or "unknown"
    )


@router.post("/register", response_model=DeviceResponse)
def register_device(request: RegisterRequest, db: Session = Depends(get_db)):
    """Leaf注册到Hub"""
    manager = get_hub_manager()
    
    # 验证本机是Hub
    if manager.get_role() != "hub":
        raise HTTPException(status_code=403, detail="Only Hub can register devices")
    
    device = manager.register_device(
        db,
        request.device_id,
        request.device_name,
        request.device_type,
        hub_url=None
    )
    
    return DeviceResponse(
        device_id=device.device_id,
        device_name=device.device_name,
        device_type=device.device_type,
        is_online=device.is_online,
        last_seen=device.last_seen.isoformat() if device.last_seen else None,
        hub_url=device.hub_url
    )


@router.delete("/devices/{device_id}")
def unregister_device(device_id: str, db: Session = Depends(get_db)):
    """移除设备"""
    manager = get_hub_manager()
    
    if manager.get_role() != "hub":
        raise HTTPException(status_code=403, detail="Only Hub can unregister devices")
    
    result = manager.unregister_device(db, device_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Device not found"))
    
    return result


@router.get("/devices", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    """获取已注册设备列表"""
    manager = get_hub_manager()
    devices = manager.get_registered_devices(db)
    return [DeviceResponse(**d) for d in devices]


@router.post("/push", response_model=PushResponse)
def push_changes(request: PushRequest, db: Session = Depends(get_db)):
    """
    Leaf推送变更到Hub
    
    请求体:
    {
        "device_id": "leaf-device-uuid",
        "changes": [
            {
                "table_name": "words",
                "operation": "INSERT",
                "record_pk": "123",
                "record_data": "{\"id\": 123, \"word_en\": \"hello\", ...}",
                "timestamp": "2026-05-22T19:00:00Z"
            }
        ]
    }
    """
    manager = get_hub_manager()
    device_id = manager.get_device_id()
    
    # 设置当前设备ID（用于变更追踪）
    set_current_device_id(device_id)
    try:
        engine = create_sync_engine(db, device_id)
        result = engine.push_changes(request.changes)
        return PushResponse(**result)
    finally:
        clear_current_device_id()


@router.post("/pull", response_model=PullResponse)
def pull_changes(request: PullRequest, db: Session = Depends(get_db)):
    """
    Leaf从Hub拉取变更
    
    请求体:
    {
        "device_id": "leaf-device-uuid",
        "since_log_id": 150
    }
    
    响应:
    {
        "changes": [...],
        "latest_log_id": 200,
        "has_more": false
    }
    """
    manager = get_hub_manager()
    device_id = manager.get_device_id()
    
    # 设置当前设备ID
    set_current_device_id(device_id)
    try:
        engine = create_sync_engine(db, device_id)
        result = engine.pull_changes(request.since_log_id)
        return PullResponse(**result)
    finally:
        clear_current_device_id()


@router.get("/status", response_model=SyncStatusResponse)
def get_sync_status(db: Session = Depends(get_db)):
    """获取同步状态"""
    manager = get_hub_manager()
    device_id = manager.get_device_id()
    
    engine = create_sync_engine(db, device_id)
    status = engine.get_sync_status()
    return SyncStatusResponse(**status)


@router.get("/discover", response_model=DiscoverResponse)
def discover_hubs():
    """
    扫描附近Hub（Leaf调用）
    
    返回局域网内发现的Cat Hub列表
    """
    scanner = get_scanner()
    
    if not scanner:
        return DiscoverResponse(hubs=[])
    
    hubs = scanner.get_discovered_hubs()
    return DiscoverResponse(hubs=[
        {
            "device_id": hub.device_id,
            "device_name": hub.device_name,
            "host": hub.host,
            "port": hub.port,
            "last_seen": hub.last_seen.isoformat()
        }
        for hub in hubs
    ])


@router.post("/switch-role", response_model=SwitchRoleResponse)
def switch_role(request: SwitchRoleRequest, db: Session = Depends(get_db)):
    """
    切换Hub/Leaf角色
    
    请求体:
    {
        "role": "hub" | "leaf",
        "hub_url": "http://192.168.1.100:7860"  // 可选，切换为leaf时指定Hub地址
    }
    """
    manager = get_hub_manager()
    
    # 如果切换为Leaf，需要设置Hub URL
    if request.role == "leaf" and request.hub_url:
        manager.set_hub_url(request.hub_url)
    
    result = manager.switch_role(request.role, db)
    return SwitchRoleResponse(**result)


@router.post("/apply-remote")
def apply_remote_changes(request: PullRequest, db: Session = Depends(get_db)):
    """
    应用从Hub拉取的远程变更（Leaf调用）
    
    请求体:
    {
        "device_id": "leaf-device-uuid",
        "since_log_id": 150
    }
    """
    manager = get_hub_manager()
    device_id = manager.get_device_id()
    
    # 先拉取变更
    set_current_device_id(device_id)
    try:
        engine = create_sync_engine(db, device_id)
        
        # 获取变更
        pull_result = engine.pull_changes(request.since_log_id)
        
        # 应用变更
        apply_result = engine.apply_changes(pull_result["changes"])
        
        # 更新同步状态
        engine.update_sync_state(pull_result["latest_log_id"])
        
        return {
            "success": True,
            "pulled": len(pull_result["changes"]),
            "applied": apply_result["applied"],
            "skipped": apply_result["skipped"],
            "errors": apply_result["errors"],
            "latest_log_id": pull_result["latest_log_id"]
        }
    finally:
        clear_current_device_id()
