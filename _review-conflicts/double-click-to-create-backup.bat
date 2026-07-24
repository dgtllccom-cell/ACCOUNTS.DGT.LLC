@echo off
cd /d "%~dp0"
echo ================================================================
echo   CREATING STABLE PRODUCTION BACKUP (v1.0.0-stable-production)
echo ================================================================
echo.
node scripts/create-production-snapshot.mjs
echo.
echo ================================================================
echo   Backup process completed!
echo ================================================================
pause
