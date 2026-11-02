@echo off
setlocal enabledelayedexpansion
title DGT ERP - Full Prototype Launcher

echo ===============================================================================
echo                        DGT ERP - FULL PROTOTYPE LAUNCHER
echo              Multi-Country Enterprise Accounting & Operational Platform
echo ===============================================================================
echo.

:: Change directory to the folder containing this batch script
cd /d "%~dp0"

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js (version 20 or higher) from https://nodejs.org/
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b 1
)

:: 2. Ensure prototype environment configuration exists
if not exist ".env.local" (
    echo [SETUP] Creating isolated prototype configuration (.env.local)...
    if exist ".env.example" (
        copy /y ".env.example" ".env.local" >nul
    ) else (
        echo APP_ENV=development > .env.local
        echo NEXT_PUBLIC_DGT_PROTOTYPE_MODE=1 >> .env.local
    )
    echo [SETUP] Isolated environment configured. Production DB is protected.
)

:: 3. Ensure dependencies are installed
if not exist "node_modules" (
    echo.
    echo [SETUP] First-time setup detected: Installing required packages...
    echo This may take a few minutes. Please wait...
    echo.
    call npm install --no-audit --prefer-offline
    if %errorlevel% neq 0 (
        echo [ERROR] Package installation failed. Please check internet connection.
        pause
        exit /b 1
    )
    echo [SETUP] Packages installed successfully!
)

:: 4. Detect Local Network IP for Mobile / Tablet Access (iPhone, iPad, Samsung)
set "LOCAL_IP=localhost"
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr "0.0.0.0" 2^>nul') do (
    if not "%%a"=="0.0.0.0" (
        set "LOCAL_IP=%%a"
    )
)

echo.
echo ===============================================================================
echo  DGT ERP Prototype is starting...
echo.
echo  [DESKTOP ACCESS]       http://localhost:3000
echo  [MOBILE / IPAD ACCESS] http://!LOCAL_IP!:3000
echo.
echo  * iPhone, iPad, and Samsung devices on the same Wi-Fi can connect to:
echo    http://!LOCAL_IP!:3000
echo.
echo  * Press Ctrl+C in this window anytime to stop the ERP server.
echo ===============================================================================
echo.

:: 5. Open browser automatically after 3 seconds in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000/dashboard/super-admin"

:: 6. Launch Next.js local server on 0.0.0.0:3000
set "PORT=3000"
set "HOSTNAME=0.0.0.0"
call npm run dev -- -H 0.0.0.0 -p 3000

pause
