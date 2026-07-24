@echo off
cd /d "%~dp0"
echo ================================================================
echo   CLEANING UNPUSHED GIT HISTORY AND PUSHING TO GITHUB MAIN
echo ================================================================
echo.

echo [1/6] Creating local safety backup branch...
git branch backup-before-history-cleanup 2>nul

echo.
echo [2/6] Resetting unpushed commits containing old secrets...
git reset --soft origin/main

echo.
echo [3/6] Unstaging all files...
git restore --staged .

echo.
echo [4/6] Staging only clean files...
git add features/journal/components/purchase-order-payment-journal.tsx
git add server-fix-502.ps1
git add scripts/healthcheck.sh
git add ecosystem.config.cjs
git add commit-and-push.bat

echo.
echo Staged files status:
git status

echo.
echo [5/6] Creating single clean commit without secrets...
git commit -m "Fix production build syntax and deployment scripts"

echo.
echo [6/6] Pushing clean commit to GitHub main...
git push origin main

if errorlevel 1 (
    echo.
    echo ================================================================
    echo   ERROR: GitHub push failed. Deployment cancelled.
    echo ================================================================
    pause
    exit /b 1
)

echo.
echo ================================================================
echo   GitHub Push Succeeded! Executing server deployment...
echo ================================================================
echo.

powershell -ExecutionPolicy Bypass -File server-fix-502.ps1
pause
