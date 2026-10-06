@echo off
cd /d "%~dp0"
echo ================================================================
echo   502 BAD GATEWAY SERVER RECOVERY
echo   This will connect to 72.60.209.121 and fix Nginx/PM2 automatically.
echo ================================================================
echo.
powershell -ExecutionPolicy Bypass -File server-fix-502.ps1
echo.
echo ================================================================
echo   Execution finished. Press any key to close this window.
echo ================================================================
pause
