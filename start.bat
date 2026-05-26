@echo off
chpp 65001 >nul
echo ======================================================
echo    Cat 密码功能方式等，函数据之一点击化
echo =====================================================
echo.
echo 欢��缺发定问题...
echo.
cd /d "%~dp0backend"
echo.
py -m uvicorn main:app --host 0.0.0.0 --port 7860
pause
