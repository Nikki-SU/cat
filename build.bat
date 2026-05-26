@echo off
chpp 65001 >nul
echo =======================================
echo   Cat - Build Desktop Version
echo =======================================
echo.

py --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ and ensure py command works.
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js 18+.
    pause
    exit /b 1
)

echo [1/6] Install backend deps...
cd backend
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
    echo [ERROR] Backend deps failed
    pause
    exit /b 1
)

echo.
echo [2/6] Install packaging tool...
pip install pyinstaller -i https://pypi.tuna.tsinghua.edu.cn/simple
if errorlevel 1 (
    echo [ERROR] Packaging tool install failed
    pause
    exit /b 1
)

echo.
echo [3/6] Build frontend...
cd ..\\frontend
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
echo [4/6] Copy frontend dist to backend/static...
if exist ..\\backend\\static rmdir /s /q ..\\backend\\static
xcopy /E /Y /Q /I dist ..\\backend\\static

echo.
echo [5/6] Ensure icon exists...
if not exist ..\\icon.ico (
    echo [WARN] icon.ico not found, packaging without custom icon
)

echo.
echo [6/6] Packaging...
cd ..\\
py -m PyInstaller cat.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] Packaging failed
    pause
    exit /b 1
)

echo.
echo =========================================
echo   Build complete!
echo   Output: dist\\Cat.exe
echo   Data dir: %APPDATA%\\Cat\\
echo   Run: dist\\Cat.exe
echo =========================================
pause
