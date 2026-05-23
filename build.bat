@echo off
chcp 65001 >nul
echo ========================================
echo   Cat - Build Desktop Version
echo ========================================
echo.

py --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

echo [1/5] Install backend deps...
cd backend
pip install pyinstaller -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
    echo [ERROR] Backend deps failed
    pause
    exit /b 1
)

echo.
echo [2/5] Build frontend...
cd ..\frontend
call npm install --registry=https://registry.npmirror.com
if errorlevel 1 (
    echo [ERROR] Frontend install failed
    pause
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed
    pause
    exit /b 1
)

echo.
echo [3/5] Copy frontend dist...
xcopy /E /Y /Q dist ..\backend\static

echo.
echo [4/5] PyInstaller packaging...
cd ..\
py -m PyInstaller cat.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] PyInstaller failed
    pause
    exit /b 1
)

echo.
echo [5/5] Done!
echo   Output: dist\Cat.exe
echo   Data: %APPDATA%\Cat\
pause
