#!/bin/bash
# Cat - Build Desktop Version (Linux/Mac)
set -e

echo "========================================="
echo "  Cat - Build Desktop Version"
echo "========================================"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python3 not found"
    exit 1
fi

# Check Node
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found"
    exit 1
fi

echo "[1/5] Install backend deps..."
cd backend
pip3 install pyinstaller
pip3 install -r requirements.txt

echo "[2/5] Build frontend..."
cd ../frontend
npm install
npm run build

echo "[3/5] Copy frontend dist..."
cp -r dist/* ../backend/static/

echo [4/5] PyInstaller packaging...
cd ..
pyinstaller cat.spec --clean --noconfirm

echo [5/5] Done!
echo "  Output: dist/Cat"
