@echo off
chcp 65001 >nul
echo ======================================================
echo    Cat - 学术文献全流程工具
echo ======================================================
echo.
echo 正在启动服务...
echo.
cd /d "%~dp0backend"
py -m uvicorn main:app --host 0.0.0.0 --port 7860
pause
