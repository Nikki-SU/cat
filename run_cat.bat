@echo off
chcp 65001 >nul
title Cat 学术文献工具
echo ================================
echo   Cat 学术文献工具 - 一键启动
echo ================================
echo.

:: 检查是否首次运行（前端是否已构建）
if not exist "backend\static\index.html" (
    echo [1/3] 首次运行，正在构建前端...
    cd frontend
    call npm install
    call npm run build
    if not exist "..\backend\static" mkdir "..\backend\static"
    xcopy /E /Y dist\* ..\backend\static\
    cd ..
    echo [1/3] 前端构建完成！
    echo.
) else (
    echo [1/3] 前端已构建，跳过
    echo.
)

:: 安装Python依赖（检查是否已安装）
echo [2/3] 检查Python依赖...
cd backend
py -m pip install -r requirements.txt -q -i https://pypi.tuna.tsinghua.edu.cn/simple 2>nul
echo [2/3] Python依赖就绪
echo.

:: 启动后端
echo [3/3] 启动服务...
echo.
echo ================================
echo   服务已启动！
echo   浏览器会自动打开
echo   地址: http://localhost:8000
echo   关闭此窗口即可停止服务
echo ================================
echo.
py -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
