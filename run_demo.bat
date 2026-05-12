@echo off
chcp 65001 >nul
echo ============================================
echo 🐱 Cat - 用户场景模拟器
echo ============================================
echo.

REM 检查Python
echo [1/3] 检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Python，请先安装Python
    pause
    exit /b 1
)
echo ✅ Python已安装

REM 检查依赖
echo.
echo [2/3] 检查依赖...
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo 🔄 正在安装依赖...
    pip install fastapi uvicorn sqlalchemy httpx pydantic aiofiles openpyxl
)
echo ✅ 依赖检查完成

REM 检查后端
echo.
echo [3/3] 检查后端服务...
python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ⚠️  后端服务未启动！
    echo.
    echo 请选择操作:
    echo [1] 自动启动后端服务（推荐）
    echo [2] 只打开演示页面（需手动启动后端）
    echo.
    set /p choice="选择 (1/2): "
    
    if "%choice%"=="1" (
        echo.
        echo 🚀 启动后端服务...
        start "Cat Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload"
        echo ⏳ 等待后端启动...
        timeout /t 3 /nobreak >nul
    )
)

REM 打开演示页面
echo.
echo 🌐 打开演示页面...
start "" "%~dp0demo_scenarios.html"

echo.
echo ============================================
echo ✅ 演示已启动！
echo.
echo 📖 访问地址:
echo    场景模拟器: demo_scenarios.html
echo    API文档:    http://localhost:8000/docs
echo    后端API:    http://localhost:8000
echo.
echo 💡 提示:
echo    • 点击"运行所有场景"查看完整演示
 echo    • 也可以单独选择某个场景运行    • 确保后端服务正常运行
 echo ============================================echo.

choice /c YN /m "是否同时运行Python场景脚本" /n
if errorlevel 2 goto :eof
if errorlevel 1 (
    echo.
    echo 🎬 运行场景模拟脚本...    python "%~dp0demo_scenarios.py"
)

pause
