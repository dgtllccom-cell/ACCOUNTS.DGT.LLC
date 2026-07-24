@echo off
cd /d "%~dp0"
echo ================================================================
echo   DEPLOYING LATEST CODE & REBUILDING SERVER (72.60.209.121)
echo   This will push all local fixes and rebuild Next.js on server.
echo ================================================================
echo.
powershell -ExecutionPolicy Bypass -File deploy-prod.ps1
echo.
echo ================================================================
echo   Deployment finished. Press any key to close this window.
echo ================================================================
pause
