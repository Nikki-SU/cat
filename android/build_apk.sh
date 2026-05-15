#!/bin/bash
# Cat APK 构建脚本
# 需要先安装 Android Studio / Android SDK
# 用法: ./build_apk.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$SCRIPT_DIR"

echo "================================"
echo "  Cat APK Builder"
echo "================================"

# 1. 构建前端
echo "[1/5] Building frontend..."
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run build

# 2. 复制后端Python代码到Android assets
echo "[2/5] Copying backend files..."
BACKEND_DIR="$ANDROID_DIR/app/src/main/python"
rm -rf "$BACKEND_DIR"/*
mkdir -p "$BACKEND_DIR"

# 复制所有backend文件
cp -r "$PROJECT_DIR/backend/"* "$BACKEND_DIR/"

# 3. 复制前端build产物到static目录
echo "[3/5] Copying frontend build..."
rm -rf "$BACKEND_DIR/static"
cp -r "$PROJECT_DIR/frontend/dist" "$BACKEND_DIR/static"

# 4. 创建数据目录
echo "[4/5] Creating data directories..."
mkdir -p "$BACKEND_DIR/data/attachments"
mkdir -p "$BACKEND_DIR/data/structured"

# 5. 构建APK
echo "[5/5] Building APK..."
cd "$ANDROID_DIR"

# 检查Gradle wrapper
if [ ! -f "gradlew" ]; then
    echo "Downloading Gradle wrapper..."
    gradle wrapper --gradle-version 8.2
fi

chmod +x gradlew
./gradlew assembleDebug --no-daemon

# 输出
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo ""
    echo "================================"
    echo "  APK built successfully!"
    echo "================================"
    echo "   $APK_PATH"
    echo ""
    echo "Size: $(du -h "$APK_PATH" | cut -f1)"
else
    echo "================================"
    echo "  APK build failed!"
    echo "================================"
    exit 1
fi
