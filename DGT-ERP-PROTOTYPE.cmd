@echo off
setlocal
title DGT ERP Prototype
cd /d "%~dp0"

echo ============================================================
echo DGT ERP FULL PROTOTYPE
echo Auto-update check + safe design-only launch
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prototype-self-update.ps1"

if not exist "%~dp0node_modules\next\dist\bin\next" (
  call "%~dp0scripts\INSTALL-FULL-ERP-PROTOTYPE-WINDOWS.cmd"
  exit /b %errorlevel%
)

call "%~dp0scripts\START-FULL-ERP-PROTOTYPE-WINDOWS.cmd"
