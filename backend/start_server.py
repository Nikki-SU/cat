"""
启动脚本 - 无需uvicorn命令，直接使用Python运行
"""
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 使用uvicorn的Python API
from uvicorn import run

if __name__ == "__main__":
    print("=" * 50)
    print("启动学术文献管理后端服务")
    print("=" * 50)
    print(f"Python版本: {sys.version}")
    print(f"工作目录: {os.getcwd()}")
    print("-" * 50)
    
    # 启动配置
    run(
        app="main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
