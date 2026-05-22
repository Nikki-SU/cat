"""
Hub/Leaf管理 - 角色检测和设备注册
"""
import os
import platform
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from models.sync import Device
from database import get_data_dir


# 角色常量
ROLE_HUB = "hub"
ROLE_LEAF = "leaf"

# 设备类型常量
DEVICE_TYPE_COMPUTER = "computer"
DEVICE_TYPE_PHONE = "phone"
DEVICE_TYPE_TABLET = "tablet"


class HubManager:
    """管理Hub/Leaf角色和设备注册"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if HubManager._initialized:
            return
        HubManager._initialized = True
        
        self._device_id: Optional[str] = None
        self._role: Optional[str] = None
        self._device_name: Optional[str] = None
        self._device_type: Optional[str] = None
        
        # 加载已保存的设备ID
        self._load_device_id()
    
    def _get_device_id_file(self) -> str:
        """获取设备ID文件路径"""
        data_dir = get_data_dir()
        return os.path.join(data_dir, "device_id.txt")
    
    def _load_device_id(self):
        """从文件加载设备ID"""
        device_file = self._get_device_id_file()
        if os.path.exists(device_file):
            try:
                with open(device_file, 'r') as f:
                    content = f.read().strip()
                    if content:
                        self._device_id = content
            except Exception:
                pass
    
    def _save_device_id(self):
        """保存设备ID到文件"""
        device_file = self._get_device_id_file()
        try:
            with open(device_file, 'w') as f:
                f.write(self._device_id or "")
        except Exception:
            pass
    
    def _generate_device_id(self) -> str:
        """生成新的设备ID"""
        return str(uuid.uuid4())
    
    def _get_device_name(self) -> str:
        """获取设备名称"""
        system = platform.system()
        if system == "Windows":
            return os.environ.get("COMPUTERNAME", "Windows电脑")
        elif system == "Darwin":
            return os.environ.get("HOSTNAME", "Mac电脑")
        elif system == "Linux":
            if "Android" in platform.version():
                return "Android设备"
            return os.environ.get("HOSTNAME", "Linux电脑")
        return "未知设备"
    
    def _detect_device_type(self) -> str:
        """检测设备类型"""
        system = platform.system()
        if system == "Windows" or system == "Darwin" or (system == "Linux" and "Android" not in platform.version()):
            return DEVICE_TYPE_COMPUTER
        return DEVICE_TYPE_PHONE
    
    def get_device_id(self) -> str:
        """获取本机设备ID，首次运行时生成并存储"""
        if not self._device_id:
            self._device_id = self._generate_device_id()
            self._save_device_id()
        return self._device_id
    
    def get_device_name(self) -> str:
        """获取设备名称"""
        if not self._device_name:
            self._device_name = self._get_device_name()
        return self._device_name
    
    def get_device_type(self) -> str:
        """获取设备类型"""
        if not self._device_type:
            self._device_type = self._detect_device_type()
        return self._device_type
    
    def detect_role(self, db: Session, force_computer_hub: bool = True) -> str:
        """
        自动检测本机角色
        
        Args:
            db: 数据库会话
            force_computer_hub: 是否强制电脑为Hub
            
        Returns:
            角色: "hub" 或 "leaf"
        """
        if self._role:
            return self._role
        
        device_type = self.get_device_type()
        
        # 电脑自动成为Hub
        if device_type == DEVICE_TYPE_COMPUTER and force_computer_hub:
            self._role = ROLE_HUB
            return self._role
        
        # 检查数据库中是否已有Hub
        existing_hub = db.query(Device).filter(
            Device.role == ROLE_HUB,
            Device.is_online == True
        ).first()
        
        if existing_hub:
            self._role = ROLE_LEAF
        else:
            # 没有Hub，成为Hub
            self._role = ROLE_HUB
        
        return self._role
    
    def set_role(self, role: str):
        """手动设置角色"""
        if role not in (ROLE_HUB, ROLE_LEAF):
            raise ValueError(f"Invalid role: {role}")
        self._role = role
    
    def get_role(self) -> Optional[str]:
        """获取当前角色"""
        return self._role
    
    def get_hub_url(self) -> Optional[str]:
        """获取连接的Hub URL"""
        return getattr(self, '_hub_url', None)
    
    def set_hub_url(self, url: Optional[str]):
        """设置连接的Hub URL"""
        self._hub_url = url
    
    def register_device(
        self,
        db: Session,
        device_id: str,
        device_name: str,
        device_type: str,
        hub_url: Optional[str] = None
    ) -> Device:
        """
        注册新设备（Hub调用，Leaf连上来时）
        
        Args:
            db: 数据库会话
            device_id: 设备ID
            device_name: 设备名称
            device_type: 设备类型
            hub_url: Leaf连接的Hub地址
            
        Returns:
            注册的设备对象
        """
        # 检查是否已存在
        existing = db.query(Device).filter(Device.device_id == device_id).first()
        
        if existing:
            existing.last_seen = datetime.utcnow()
            existing.is_online = True
            if hub_url:
                existing.hub_url = hub_url
            db.commit()
            return existing
        
        # 创建新设备
        device = Device(
            device_id=device_id,
            device_name=device_name,
            device_type=device_type,
            role=ROLE_LEAF,
            hub_url=hub_url,
            is_online=True,
            last_seen=datetime.utcnow()
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        return device
    
    def unregister_device(self, db: Session, device_id: str) -> Dict:
        """
        移除设备
        
        Args:
            db: 数据库会话
            device_id: 设备ID
            
        Returns:
            结果
        """
        device = db.query(Device).filter(Device.device_id == device_id).first()
        
        if not device:
            return {"success": False, "error": "Device not found"}
        
        device.is_online = False
        db.commit()
        return {"success": True}
    
    def get_registered_devices(self, db: Session) -> List[Dict]:
        """
        获取已注册设备列表
        
        Args:
            db: 数据库会话
            
        Returns:
            设备列表
        """
        devices = db.query(Device).filter(
            Device.role == ROLE_LEAF
        ).all()
        
        return [
            {
                "device_id": d.device_id,
                "device_name": d.device_name,
                "device_type": d.device_type,
                "is_online": d.is_online,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
                "hub_url": d.hub_url
            }
            for d in devices
        ]
    
    def update_device_status(self, db: Session, device_id: str, is_online: bool):
        """更新设备在线状态"""
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if device:
            device.is_online = is_online
            device.last_seen = datetime.utcnow()
            db.commit()
    
    def switch_role(self, new_role: str, db: Optional[Session] = None) -> Dict:
        """
        切换Hub/Leaf角色
        
        Args:
            new_role: 新角色
            db: 数据库会话（用于注册本机到Hub）
            
        Returns:
            结果
        """
        if new_role not in (ROLE_HUB, ROLE_LEAF):
            return {"success": False, "error": "Invalid role"}
        
        old_role = self._role
        self._role = new_role
        
        # 如果变成Leaf，注册到Hub
        if new_role == ROLE_LEAF and db:
            hub_url = self.get_hub_url()
            if hub_url:
                self.register_device(
                    db,
                    self.get_device_id(),
                    self.get_device_name(),
                    self.get_device_type(),
                    hub_url
                )
        
        return {
            "success": True,
            "old_role": old_role,
            "new_role": new_role
        }
    
    def get_hub_info(self) -> Dict:
        """获取本机Hub信息（用于被发现）"""
        return {
            "device_id": self.get_device_id(),
            "device_name": self.get_device_name(),
            "device_type": self.get_device_type(),
            "role": self.get_role()
        }


# 全局实例
_hub_manager: Optional[HubManager] = None


def get_hub_manager() -> HubManager:
    """获取Hub管理器实例"""
    global _hub_manager
    if _hub_manager is None:
        _hub_manager = HubManager()
    return _hub_manager
