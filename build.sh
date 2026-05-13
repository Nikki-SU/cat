#!/bin/bash
echo "=============================================================="
echo "  Cat - 构建前端静态文件"
echo "=============================================================="
echo ""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js"
    exit 1
fi
echo "步骤1/3: 安装前端依赖..."
cd frontend
[ ! -d "node_modules" ] && npm install --registry=https://registry.npmmirror.com || echo "跳过..."
echo ""
echo "步骤2/3: 构建前端..."
npm run build
[ ! -d "dist" ] && exit 1
echo ""
echo "步骤3/3: 复制静态文件到后端..."
cd "$SCRIPT_DIR"
rm -rf backend/static 2>/dev/null
cp -r frontend/dist backend/static
echo ""
echo "=============================================================="
echo "  构建完成！访问 http://localhost:8000"
echo "=============================================================="
