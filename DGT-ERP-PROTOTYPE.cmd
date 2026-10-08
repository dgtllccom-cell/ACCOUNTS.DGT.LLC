@echo off
setlocal
title DGT ERP FULL PROTOTYPE
cd /d "%~dp0"

echo ============================================================
echo DGT ERP FULL UI PROTOTYPE
echo SAFE START - NO UPDATE CHECK
echo ============================================================
echo.

if not exist "%~dp0node_modules\next\dist\bin\next" (
  call "%~dp0scripts\INSTALL-FULL-ERP-PROTOTYPE-WINDOWS.cmd"
  exit /b %errorlevel%
)

call "%~dp0scripts\START-FULL-ERP-PROTOTYPE-WINDOWS.cmd"
