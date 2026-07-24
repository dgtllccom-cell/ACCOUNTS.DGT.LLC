@echo off
cd /d "%~dp0"
echo ================================================================
echo   AUTOMATED GIT UNLOCK & PUSH TO ACCOUNTS.DGT.LLC
echo ================================================================
echo.
node unlock-and-commit.mjs
echo.
echo ================================================================
echo   Done! Press any key to close.
echo ================================================================
pause
