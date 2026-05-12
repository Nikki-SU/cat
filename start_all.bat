@echo off
chcp 65001 >nul
title Cat - 学术文献管理工具
color 0A

cls
echo ╔══════════════════════════════════════════════════════════╗
echo ║          🐱 Cat - 学术文献全流程管理工具                 ║
echo ║                                                          ║
echo ║   追踪 → 入库 → 阅读 → 笔记 → 学习                     ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: 检查Python
echo [1/5] 检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到Python，请先安装Python
    pause
    exit /b 1
)
echo [OK] Python已安装

:: 检查依赖
echo.
echo [2/5] 检查依赖...
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [INFO] 正在安装依赖...
    pip install -r backend\requirements.txt 2>nul || pip install fastapi uvicorn sqlalchemy httpx pydantic aiofiles openpyxl
)
echo [OK] 依赖检查完成

:: 创建数据目录
echo.
echo [3/5] 初始化数据目录...
if not exist data mkdir data
if not exist data\attachments mkdir data\attachments
echo [OK] 数据目录准备完成

:: 启动后端
echo.
echo [4/5] 启动后端服务...
echo [INFO] 后端将运行在 http://localhost:8000
echo [INFO] API文档: http://localhost:8000/docs
echo.
start "Cat Backend" cmd /k "cd /d %~dp0backend && echo 正在启动后端服务... && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

:: 等待后端启动
echo [INFO] 等待后端启动...
timeout /t 5 /nobreak >nul

:: 检查后端是否启动成功
echo.
echo [5/5] 检查服务状态...
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] 后端可能还在启动中，请稍等...
    timeout /t 3 /nobreak >nul
)

:: 启动前端演示页面
echo [INFO] 启动前端演示页面...
echo.
start "" "%~dp0demo_scenarios.html"
start "" "http://localhost:8000/docs"

cls
echo ╔══════════════════════════════════════════════════════════╗
echo ║          ✅ Cat 服务已全部启动！                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo 📌 访问地址：
echo    • 场景演示器：  demo_scenarios.html（本地文件）
echo    • API文档：     http://localhost:8000/docs
echo    • 后端API：     http://localhost:8000
echo    • 健康检查：    http://localhost:8000/health
echo.
echo 📋 快速开始：
echo    1. 在浏览器中查看演示页面
echo    2. 点击"运行所有场景"测试功能
echo    3. 查看Swagger文档了解API详情
echo.
echo 🛑 停止服务：
echo    • 关闭"Cat Backend"窗口停止后端
echo    • 直接关闭此窗口
echo.
echo ═══════════════════════════════════════════════════════════
pause
