"""
本地网络发现 - UDP广播方案
Hub定期广播自己的存在，Leaf监听并维护Hub列表
"""
import socket
import json
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

# 广播配置
BROADCAST_PORT = 7861
BROADCAST_INTERVAL = 5  # 秒
HUB_TIMEOUT = 30  # Hub超时时间（秒）


@dataclass
class HubInfo:
    """Hub信息"""
    device_id: str
    device_name: str
    host: str
    port: int
    last_seen: datetime
    
    def is_expired(self) -> bool:
        """检查是否已超时"""
        return datetime.now() - self.last_seen > timedelta(seconds=HUB_TIMEOUT)
    
    def to_dict(self) -> Dict:
        return {
            "device_id": self.device_id,
            "device_name": self.device_name,
            "host": self.host,
            "port": self.port,
            "last_seen": self.last_seen.isoformat()
        }


class HubBroadcaster:
    """Hub广播自己的存在"""
    
    def __init__(
        self,
        device_id: str,
        device_name: str,
        host: Optional[str] = None,
        port: int = 7860
    ):
        self.device_id = device_id
        self.device_name = device_name
        self.host = host or self._get_local_ip()
        self.port = port
        self.socket: Optional[socket.socket] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
    
    def _get_local_ip(self) -> str:
        """获取本机IP地址"""
        try:
            # 创建UDP socket连接外部地址来获取本机IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"
    
    def _broadcast_loop(self):
        """广播循环"""
        while self.running:
            try:
                self._send_broadcast()
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
            time.sleep(BROADCAST_INTERVAL)
    
    def _send_broadcast(self):
        """发送广播"""
        if not self.socket:
            return
        
        message = json.dumps({
            "type": "cat_hub",
            "device_id": self.device_id,
            "device_name": self.device_name,
            "host": self.host,
            "port": self.port
        })
        
        try:
            # 发送到广播地址
            self.socket.sendto(
                message.encode('utf-8'),
                ('<broadcast>', BROADCAST_PORT)
            )
            logger.debug(f"Broadcast sent: {message}")
        except Exception as e:
            logger.error(f"Failed to send broadcast: {e}")
    
    def start(self):
        """启动广播"""
        if self.running:
            return
        
        try:
            # 创建UDP socket
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.bind(('', BROADCAST_PORT))
            self.socket.settimeout(1)
            
            self.running = True
            self.thread = threading.Thread(target=self._broadcast_loop, daemon=True)
            self.thread.start()
            logger.info(f"Hub broadcaster started on {self.host}:{BROADCAST_PORT}")
        except Exception as e:
            logger.error(f"Failed to start broadcaster: {e}")
            self.stop()
    
    def stop(self):
        """停止广播"""
        self.running = False
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None
        if self.thread:
            self.thread.join(timeout=2)
            self.thread = None
        logger.info("Hub broadcaster stopped")


class HubScanner:
    """Leaf扫描附近的Hub"""
    
    def __init__(self):
        self.socket: Optional[socket.socket] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.hubs: Dict[str, HubInfo] = {}
        self.lock = threading.Lock()
    
    def _scan_loop(self):
        """扫描循环"""
        while self.running:
            try:
                self._receive_broadcast()
            except Exception as e:
                logger.debug(f"Scan loop error: {e}")
    
    def _receive_broadcast(self):
        """接收广播"""
        if not self.socket:
            return
        
        try:
            self.socket.settimeout(1)
            data, addr = self.socket.recvfrom(4096)
            message = json.loads(data.decode('utf-8'))
            
            if message.get("type") == "cat_hub":
                hub_info = HubInfo(
                    device_id=message.get("device_id", ""),
                    device_name=message.get("device_name", "Unknown"),
                    host=message.get("host", addr[0]),
                    port=message.get("port", 7860),
                    last_seen=datetime.now()
                )
                
                with self.lock:
                    self.hubs[hub_info.device_id] = hub_info
                    logger.debug(f"Discovered hub: {hub_info.device_name} at {hub_info.host}:{hub_info.port}")
                    
        except socket.timeout:
            pass
        except json.JSONDecodeError:
            pass
        except Exception as e:
            logger.debug(f"Receive error: {e}")
    
    def _cleanup_loop(self):
        """清理超时的Hub"""
        while self.running:
            with self.lock:
                expired = [
                    device_id for device_id, hub in self.hubs.items()
                    if hub.is_expired()
                ]
                for device_id in expired:
                    del self.hubs[device_id]
                    logger.debug(f"Hub expired: {device_id}")
            
            time.sleep(5)
    
    def start(self):
        """启动扫描"""
        if self.running:
            return
        
        try:
            # 创建UDP socket
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.bind(('', BROADCAST_PORT))
            self.socket.settimeout(0.5)
            
            self.running = True
            self.thread = threading.Thread(target=self._scan_loop, daemon=True)
            self.thread.start()
            
            # 启动清理线程
            self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
            self.cleanup_thread.start()
            
            logger.info(f"Hub scanner started on port {BROADCAST_PORT}")
        except Exception as e:
            logger.error(f"Failed to start scanner: {e}")
            self.stop()
    
    def stop(self):
        """停止扫描"""
        self.running = False
        if self.socket:
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None
        if self.thread:
            self.thread.join(timeout=2)
            self.thread = None
        if hasattr(self, 'cleanup_thread'):
            self.cleanup_thread.join(timeout=2)
        logger.info("Hub scanner stopped")
    
    def get_discovered_hubs(self) -> List[HubInfo]:
        """获取发现的Hub列表"""
        with self.lock:
            # 清理过期的Hub
            expired = [k for k, v in self.hubs.items() if v.is_expired()]
            for k in expired:
                del self.hubs[k]
            
            return [hub for hub in self.hubs.values() if not hub.is_expired()]
    
    def get_best_hub(self) -> Optional[HubInfo]:
        """获取最优的Hub（取最新的）"""
        hubs = self.get_discovered_hubs()
        if not hubs:
            return None
        return max(hubs, key=lambda h: h.last_seen)


# 全局实例
_broadcaster: Optional[HubBroadcaster] = None
_scanner: Optional[HubScanner] = None


def start_broadcaster(device_id: str, device_name: str, host: Optional[str] = None) -> HubBroadcaster:
    """启动Hub广播"""
    global _broadcaster
    if _broadcaster:
        _broadcaster.stop()
    _broadcaster = HubBroadcaster(device_id, device_name, host)
    _broadcaster.start()
    return _broadcaster


def stop_broadcaster():
    """停止Hub广播"""
    global _broadcaster
    if _broadcaster:
        _broadcaster.stop()
        _broadcaster = None


def start_scanner() -> HubScanner:
    """启动Hub扫描"""
    global _scanner
    if _scanner:
        _scanner.stop()
    _scanner = HubScanner()
    _scanner.start()
    return _scanner


def stop_scanner():
    """停止Hub扫描"""
    global _scanner
    if _scanner:
        _scanner.stop()
        _scanner = None


def get_scanner() -> Optional[HubScanner]:
    """获取扫描器实例"""
    return _scanner


def get_broadcaster() -> Optional[HubBroadcaster]:
    """获取广播器实例"""
    return _broadcaster
