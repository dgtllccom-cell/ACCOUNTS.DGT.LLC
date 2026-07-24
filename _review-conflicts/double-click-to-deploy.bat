@echo off
cd /d "%~dp0"
echo ================================================================
echo   DIGITAL DOCK ERP - MASTER AUTOMATED DEPLOYMENT & VERIFICATION
echo ================================================================
echo.
node deploy-and-verify.js
echo.
echo ================================================================
echo   Finished. Press any key to close this window.
echo ================================================================
pause

