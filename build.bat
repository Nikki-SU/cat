@echo off
chcp 65001 >nul
echo ===============================================================
echo    Cat - 构建前端静态文件
echo ===============================================================
cd /d "%~dp0"
echo 步骤1/3: 安装前端依赖...
cd frontend
if not exist "node_modules" call npm install --registry=https://registry.npmmirror.com
echo.
echo 步骤2/3: 构建前端...
call npm run build
if not exist "dist" (echo 错误! & pause & exit /b 1)
echo.
echo 步骤3/3: 复制静态文件到后端...
cd /d "%~dp0"
if exist "backend\static" rmdir /s /q "backend\static"
xcopy /s /e /i /y "frontend\dist" "backend\static"
echo.
echo 构建完成! 访问 http://localhost:8000
pause
