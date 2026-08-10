@echo off
cd /d "%~dp0"
echo =======================================================================
echo   1-CLICK CODE SYNC ^& VPS PRODUCTION DEPLOYMENT
echo   Repository: dgtllccom-cell/ACCOUNTS.DGT.LLC
echo   Target VPS: 72.60.209.121
echo =======================================================================
echo.

if exist ".git\index.lock" del /f /q ".git\index.lock"
node deploy-vps-and-local.mjs

echo.
echo =======================================================================
echo   DEPLOYMENT PROCESS COMPLETE!
echo =======================================================================
pause
