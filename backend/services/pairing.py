"""
配对码系统 - 用于跨网络设备配对

流程：
1. Hub生成6位数字配对码（有效期120秒）
2. 配对码对应一个预共享密钥(PSK)
3. Leaf输入配对码后，通过中继服务器验证配对码
4. 验证通过后，双方交换设备信息和加密密钥
5. 之后Leaf通过中继与Hub建立加密通道
"""
import secrets
import string
import time
import json
from typing import Optional, Dict

class PairingManager:
    """配对码管理器"""
    
    def __init__(self):
        self._pairing_codes: Dict[str, dict] = {}  # code -> {device_id, psk, created_at, hub_info}
    
    def generate_code(self, device_id: str, hub_info: dict) -> dict:
        """生成配对码
        Returns: {"code": "837421", "psk": "xxx", "expires_at": timestamp}
        """
        # 生成6位数字
        code = ''.join(secrets.choice(string.digits) for _ in range(6))
        psk = secrets.token_hex(32)  # 预共享密钥
        expires_at = time.time() + 120  # 120秒有效
        
        self._pairing_codes[code] = {
            "hub_device_id": device_id,
            "psk": psk,
            "created_at": time.time(),
            "expires_at": expires_at,
            "hub_info": hub_info,  # {device_name, relay_url, relay_token}
        }
        
        # 清理过期配对码
        self._cleanup_expired()
        
        return {"code": code, "psk": psk, "expires_at": expires_at}
    
    def verify_code(self, code: str) -> Optional[dict]:
        """验证配对码，返回配对信息或None"""
        if code not in self._pairing_codes:
            return None
        entry = self._pairing_codes[code]
        if time.time() > entry["expires_at"]:
            del self._pairing_codes[code]
            return None
        return entry
    
    def consume_code(self, code: str) -> Optional[dict]:
        """消费配对码（一次性使用），返回配对信息"""
        result = self.verify_code(code)
        if result:
            del self._pairing_codes[code]
        return result
    
    def _cleanup_expired(self):
        """清理过期的配对码"""
        now = time.time()
        expired = [k for k, v in self._pairing_codes.items() if now > v["expires_at"]]
        for k in expired:
            del self._pairing_codes[k]
    
    def get_code_info(self, code: str) -> Optional[dict]:
        """获取配对码信息（不暴露PSK）"""
        if code not in self._pairing_codes:
            return None
        entry = self._pairing_codes[code]
        if time.time() > entry["expires_at"]:
            del self._pairing_codes[code]
            return None
        return {
            "hub_device_id": entry["hub_device_id"],
            "hub_info": entry["hub_info"],
            "expires_at": entry["expires_at"]
        }

# 全局实例
pairing_manager = PairingManager()
