#!/bin/bash
echo "=============================================================="
echo "  Cat 学术文献全流程工具 (Termux)"
echo "=============================================================="
echo ""
if ! command -v python &> /dev/null; then
    echo "正在安装Python..."
    pkg install python -y
fi
echo "正在检查Python依赖..."
cd "$(dirname "$0")/backend"
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple 2>/dev/null || true
echo ""
echo "正在启动后端服务..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000
