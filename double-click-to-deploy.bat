@echo off
cd /d "%~dp0"
echo ================================================================
echo   REMOVING LARGE FILES (>100MB) & PUSHING TO ACCOUNTS.DGT.LLC
echo ================================================================
echo.
node sync-and-deploy-accounts-dgt.mjs
echo.
echo ================================================================
echo   Finished. Press any key to close this window.
echo ================================================================
pause
