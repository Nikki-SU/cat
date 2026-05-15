@echo off
REM Cat APK Build Script for Windows
REM 需要先安装 Android Studio / Android SDK

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "ANDROID_DIR=%SCRIPT_DIR%"

echo ========================================
echo   Cat APK Builder
echo ========================================

REM 1. Build frontend
echo [1/5] Building frontend...
cd /d "%PROJECT_DIR%\frontend"
if not exist "node_modules" (
    call npm install
)
call npm run build

REM 2. Copy backend files
echo [2/5] Copying backend files...
set "BACKEND_DIR=%ANDROID_DIR%app\src\main\python"
if exist "%BACKEND_DIR%" (
    rmdir /s /q "%BACKEND_DIR%"
)
mkdir "%BACKEND_DIR%"
xcopy /s /e /y "%PROJECT_DIR%\backend\*" "%BACKEND_DIR%\"

REM 3. Copy frontend build
echo [3/5] Copying frontend build...
if exist "%BACKEND_DIR%\static" (
    rmdir /s /q "%BACKEND_DIR%\static"
)
xcopy /s /e /y "%PROJECT_DIR%\frontend\dist" "%BACKEND_DIR%\static\"

REM 4. Create data directories
echo [4/5] Creating data directories...
mkdir "%BACKEND_DIR%\data\attachments" 2>nul
mkdir "%BACKEND_DIR%\data\structured" 2>nul

REM 5. Build APK
echo [5/5] Building APK...
cd /d "%ANDROID_DIR%"

REM Check for Gradle
if not exist "gradlew.bat" (
    echo Downloading Gradle wrapper...
    gradle wrapper --gradle-version 8.2
)

call gradlew.bat assembleDebug --no-daemon

REM Output
set "APK_PATH=%ANDROID_DIR%app\build\outputs\apk\debug\app-debug.apk"
if exist "%APK_PATH%" (
    echo.
    echo ========================================
    echo   APK built successfully!
    echo ========================================
    echo    %APK_PATH%
    echo.
    for %%A in ("%APK_PATH%") do echo Size: %%~zA bytes
) else (
    echo ========================================
    echo   APK build failed!
    echo ========================================
    exit /b 1
)

endlocal
