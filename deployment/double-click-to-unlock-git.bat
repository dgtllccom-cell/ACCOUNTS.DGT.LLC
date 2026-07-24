@echo off
cd /d "%~dp0\.."
echo ================================================================
echo   GIT LOCK & IPC SOCKET RECOVERY
echo ================================================================
echo.
powershell -ExecutionPolicy Bypass -File deployment/fix-git-lock.ps1
echo.
pause
