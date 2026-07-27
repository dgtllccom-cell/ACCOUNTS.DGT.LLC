@echo off
cd /d "%~dp0"
echo =======================================================================
echo   AUTOMATED 1-CLICK DEPLOYMENT ^& SUPABASE DATABASE SYNCHRONIZATION
echo   Repository : dgtllccom-cell/ACCOUNTS.DGT.LLC
echo   Server     : 72.60.209.121
echo =======================================================================
echo.

echo [1/5] Synchronizing local schema migrations with central Supabase DB...
node scripts/sync-supabase-db.mjs
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Database sync failed with code %errorlevel%. Deployment aborted.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/5] Staging latest source code...
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git 2>nul || git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git add .

echo.
echo [3/5] Committing changes...
git commit -m "feat(deploy): production build stability, Node 22 upgrade ^& zero-error verification" 2>nul

echo.
echo [4/5] Pushing to GitHub (dgtllccom-cell/ACCOUNTS.DGT.LLC:main)...
git push origin main
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Git push failed with code %errorlevel%. Deployment aborted.
    pause
    exit /b %errorlevel%
)

echo.
echo [5/5] Deploying latest build to Production Server (72.60.209.121)...
node run-vps-fix.mjs
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Remote server build or deployment failed with code %errorlevel%. Deployment aborted.
    pause
    exit /b %errorlevel%
)

echo.
echo =======================================================================
echo   DEPLOYMENT ^& DATABASE SYNC FULLY SUCCESSFUL!
echo =======================================================================
pause
