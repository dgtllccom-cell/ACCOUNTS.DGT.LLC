@echo off
setlocal enabledelayedexpansion

echo =================================================================
echo   DIGITAL DOCK ERP - ONE-CLICK PRODUCTION VPS DEPLOYMENT
echo =================================================================
echo.

cd /d "%~dp0"

echo [1/3] Pushing latest code to GitHub (main and production branches)...
set DGT_PROD_PUSH_APPROVED=1
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo Error pushing to origin main.
    pause
    exit /b %ERRORLEVEL%
)

git push origin main:production
if %ERRORLEVEL% NEQ 0 (
    echo Error pushing to origin production.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Connecting to VPS to approve and trigger deployment...
for /f "tokens=*" %%a in ('git rev-parse HEAD') do set COMMIT_SHA=%%a
echo Deploying commit: %COMMIT_SHA%

ssh root@72.60.209.121 "dgt-approve-deploy %COMMIT_SHA% && dgt-deploy"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =================================================================
    echo   SUCCESS: Production VPS deployed and restarted successfully!
    echo =================================================================
) else (
    echo.
    echo Deployment encountered an issue. Please review the output above.
)

pause
