"""配置持久化服务 - 将设置保存到本地JSON文件"""
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

# 配置文件路径：与database.py使用相同的DATA_DIR
def _get_data_dir():
    """获取数据目录，与database.py保持一致"""
    # Android/Chaquopy: data directory passed from PythonService
    if os.getenv("CAT_DATA_DIR"):
        return os.getenv("CAT_DATA_DIR")
    # Desktop: use backend/data relative path
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

DATA_DIR = _get_data_dir()
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")

DEFAULT_CONFIG = {
    "ai": {
        "api_key": None,
        "api_base": "https://api.openai.com/v1",
        "model": "gpt-3.5-turbo"
    },
    "mineru": {
        "api_token": None,
        "model_version": "vlm",
        "language": "en"
    },
    "tracking": {
        "interval": 7,
        "display_language": "cn",
        "display_detail": "detailed"
    },
    "learning": {
        "word_queue_length": 7,
        "allow_skip": True,
        "question_types": ["en2cn", "cn2en", "en2def", "def2en", "sent2cn", "sent2def"],
        "translation_mode": "flash",
        "review_mode": "interval"
    },
    "ocr": {
        "simpletex_app_id": None,
        "simpletex_app_secret": None
    },
    "search_engines": {
        "engines": [
            {"id": "doi", "name": "DOI直达", "icon": "🔗", "url_template": "https://doi.org/{query}", "enabled": True},
            {"id": "crossref", "name": "CrossRef", "icon": "📋", "url_template": "https://api.crossref.org/works/{query}", "enabled": True},
            {"id": "xmol", "name": "X-MOL", "icon": "🧪", "url_template": "https://www.x-mol.com/search?query={query}", "enabled": True},
            {"id": "scholarscope", "name": "谷粉学术", "icon": "🎓", "url_template": "https://gff.scholarscope.com/?k={query}", "enabled": True},
            {"id": "google_scholar", "name": "Google Scholar", "icon": "🔍", "url_template": "https://scholar.google.com/scholar?q={query}", "enabled": True},
            {"id": "semantic", "name": "Semantic Scholar", "icon": "🤖", "url_template": "https://www.semanticscholar.org/search?q={query}", "enabled": True},
        ]
    }
}


class ConfigService:
    """配置持久化服务"""
    
    def __init__(self, config_file: str = None):
        self.config_file = config_file or CONFIG_FILE
        self._config: Dict[str, Any] = {}
        self._load()
    
    def _load(self):
        """从文件加载配置"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                # 深度合并：DEFAULT_CONFIG为基础，saved覆盖
                self._config = self._deep_merge(DEFAULT_CONFIG.copy(), saved)
            except (json.JSONDecodeError, IOError):
                self._config = DEFAULT_CONFIG.copy()
        else:
            self._config = DEFAULT_CONFIG.copy()
            self._ensure_dir()
            self._save()
    
    def _deep_merge(self, base: dict, override: dict) -> dict:
        """深度合并字典"""
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                base[key] = self._deep_merge(base[key], value)
            else:
                base[key] = value
        return base
    
    def _save(self):
        """保存配置到文件"""
        self._ensure_dir()
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self._config, f, ensure_ascii=False, indent=2)
    
    def _ensure_dir(self):
        """确保目录存在"""
        os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
    
    def get(self, section: str, key: str, default: Any = None) -> Any:
        """获取配置值"""
        return self._config.get(section, {}).get(key, default)
    
    def get_section(self, section: str) -> Dict[str, Any]:
        """获取整个配置节"""
        return self._config.get(section, {})
    
    def set(self, section: str, key: str, value: Any):
        """设置配置值"""
        if section not in self._config:
            self._config[section] = {}
        self._config[section][key] = value
        self._save()
    
    def set_section(self, section: str, values: Dict[str, Any]):
        """设置整个配置节"""
        self._config[section] = values
        self._save()
    
    def get_all(self) -> Dict[str, Any]:
        """获取所有配置"""
        return self._config.copy()


# 全局单例
_config_service: Optional[ConfigService] = None

def get_config_service() -> ConfigService:
    global _config_service
    if _config_service is None:
        _config_service = ConfigService()
    return _config_service
