@echo off
cd /d "%~dp0"
echo ================================================================
echo   FIXING GIT PUSH SECRET & SQUASHING HISTORY
echo ================================================================
echo.
powershell -ExecutionPolicy Bypass -File fix-git-secret-push.ps1
echo.
echo ================================================================
echo   Finished. Press any key to exit.
echo ================================================================
pause
