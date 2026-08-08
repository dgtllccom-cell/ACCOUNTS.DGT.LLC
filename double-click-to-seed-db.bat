@echo off
cd /d "%~dp0"
echo ================================================================
echo   POPULATING LOCAL DATABASE WITH USERS, ACCOUNTS & EMPLOYEES
echo ================================================================
echo.
node scripts/seed-database-users-accounts-employees.mjs
node scripts/translate-all-database-english-records.mjs
echo.
echo ================================================================
echo   DEPLOYING & SEEDING PRODUCTION VPS SERVER (72.60.209.121)
echo ================================================================
echo.
powershell -ExecutionPolicy Bypass -File server-fix-502.ps1
echo.
pause
