@echo off
setlocal
title DGT ERP FULL PROTOTYPE - INSTALL
cd /d "%~dp0.."

echo ============================================================
echo DGT ERP FULL UI PROTOTYPE - FIRST TIME SETUP
echo Design only. Production data will NOT be connected.
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Please install Node.js 22 LTS, then run this file again.
    pause
    exit /b 1
  )
  echo Installing Node.js LTS...
  winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo Node.js installation failed. Please install Node.js 22 LTS manually.
    pause
    exit /b 1
  )
  echo.
  echo Node.js was installed. Close this window, reopen the extracted folder,
  echo and run this installer one more time.
  pause
  exit /b 0
)

for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node"') do set NODEMAJOR=%%A
if %NODEMAJOR% LSS 20 (
  echo Node.js is too old. Version 22 LTS is recommended.
  pause
  exit /b 1
)

if not exist node_modules\next\dist\bin\next (
  echo Installing prototype dependencies. This is required only the first time.
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    echo Check internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Setup complete.
echo Starting the full ERP prototype...
echo.
call scripts\START-FULL-ERP-PROTOTYPE-WINDOWS.cmd
