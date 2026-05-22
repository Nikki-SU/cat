"""
中继客户端 - 通过Cloudflare Worker转发加密流量

原理：
1. Hub和Leaf都连接到同一个中继Worker
2. 使用配对码生成的PSK加密所有通信
3. Worker只看到加密字节流，无法解密
4. 消息格式：{"from": device_id, "to": device_id, "data": encrypted_bytes, "type": "sync/pairing"}

中继Worker API：
- POST /connect  - 建立WebSocket连接（返回channel_id）
- POST /send     - 发送消息 {channel_id, target_device, encrypted_data}
- GET  /receive  - 长轮询获取消息 {channel_id, timeout: 30}
- POST /pair     - 配对验证 {code, device_info}
"""
import httpx
import json
import asyncio
import base64
from typing import Optional, Dict, Any

class RelayClient:
    """中继客户端"""
    
    def __init__(self, relay_url: str = None):
        self.relay_url = relay_url  # Cloudflare Worker URL
        self.channel_id = None
        self.device_id = None
        self.psk = None  # 预共享密钥，用于加密
        self._connected = False
    
    def set_relay(self, url: str):
        """设置中继服务器地址"""
        self.relay_url = url.rstrip('/')
    
    def is_configured(self) -> bool:
        """检查是否配置了中继服务器"""
        return bool(self.relay_url)
    
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._connected and self.channel_id is not None
    
    async def pair_with_code(self, code: str, device_info: dict) -> dict:
        """通过配对码配对
        1. 向中继发送配对码
        2. 中继验证配对码
        3. 返回Hub的连接信息
        """
        if not self.relay_url:
            raise ValueError("未配置中继服务器")
        
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.relay_url}/pair", json={
                "code": code,
                "device_info": device_info
            })
            resp.raise_for_status()
            return resp.json()
    
    async def register_code(self, code: str, psk: str, hub_info: dict, expires_at: float) -> dict:
        """Hub向中继注册配对码
        1. Hub生成配对码后，将配对码注册到中继
        2. Leaf连接中继时，中继验证配对码并返回Hub信息
        """
        if not self.relay_url:
            raise ValueError("未配置中继服务器")
        
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.relay_url}/register-code", json={
                "code": code,
                "psk": psk,
                "hub_info": hub_info,
                "expires_at": expires_at
            })
            resp.raise_for_status()
            return resp.json()
    
    async def connect(self, device_id: str, psk: str) -> dict:
        """建立中继连接"""
        if not self.relay_url:
            raise ValueError("未配置中继服务器")
        
        self.device_id = device_id
        self.psk = psk
        
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.relay_url}/connect", json={
                "device_id": device_id
            })
            resp.raise_for_status()
            result = resp.json()
            self.channel_id = result["channel_id"]
            self._connected = True
            return result
    
    async def disconnect(self):
        """断开中继连接"""
        self.channel_id = None
        self._connected = False
    
    async def send_sync_data(self, target_device: str, data: dict) -> dict:
        """发送同步数据（加密后）"""
        if not self.channel_id:
            raise ValueError("未建立中继连接")
        
        # 加密数据
        encrypted = self._encrypt(json.dumps(data))
        
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.relay_url}/send", json={
                "channel_id": self.channel_id,
                "from_device": self.device_id,
                "to_device": target_device,
                "data": encrypted
            })
            resp.raise_for_status()
            return resp.json()
    
    async def receive_sync_data(self, timeout: int = 30) -> Optional[dict]:
        """接收同步数据（长轮询）"""
        if not self.channel_id:
            return None
        
        try:
            async with httpx.AsyncClient(timeout=timeout + 5) as client:
                resp = await client.get(
                    f"{self.relay_url}/receive",
                    params={"channel_id": self.channel_id, "timeout": timeout}
                )
                if resp.status_code == 200:
                    result = resp.json()
                    if result.get("messages") and len(result["messages"]) > 0:
                        # 解密并返回第一条消息
                        msg = result["messages"][0]
                        if msg.get("data"):
                            return self._decrypt(msg["data"])
                        return msg
                return None
        except (httpx.TimeoutException, httpx.ConnectError):
            return None
    
    async def health_check(self) -> dict:
        """健康检查"""
        if not self.relay_url:
            return {"status": "not_configured"}
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.relay_url}/health")
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _encrypt(self, plaintext: str) -> str:
        """简单XOR加密（演示用，生产环境应使用AES-256-GCM）"""
        key_bytes = (self.psk or "default").encode()
        data_bytes = plaintext.encode()
        encrypted = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data_bytes))
        return base64.b64encode(encrypted).decode()
    
    def _decrypt(self, ciphertext: str) -> dict:
        """解密"""
        key_bytes = (self.psk or "default").encode()
        data = base64.b64decode(ciphertext)
        decrypted = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data))
        return json.loads(decrypted.decode())

# 全局实例
relay_client = RelayClient()
