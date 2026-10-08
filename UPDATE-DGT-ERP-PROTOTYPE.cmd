@echo off
setlocal
title Update DGT ERP Prototype
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prototype-self-update.ps1"
echo.
echo Update check finished.
pause
