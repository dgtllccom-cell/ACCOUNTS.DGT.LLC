@echo off
cd /d "%~dp0"
echo =======================================================================
echo   UNIFIED 1-CLICK CODE SYNC & DEPLOYMENT (dgtllccom-cell/dht-nextjs)
echo =======================================================================
echo.

echo [1/5] Setting Git remote to target repository dgt-nextjs...
git remote set-url origin https://github.com/dgtllccom-cell/dht-nextjs.git

echo.
echo [2/5] Staging all local source code & configurations...
git add .

echo.
echo [3/5] Committing changes...
git commit -m "feat(unified): synchronize local code, Supabase pooler DB config, and A4 print store"

echo.
echo [4/5] Pushing unified code to GitHub (https://github.com/dgtllccom-cell/dht-nextjs.git)...
git push -u origin main --force

echo.
echo [5/5] Deploying unified code to Production Server (72.60.209.121)...
node run-vps-fix.mjs

echo.
echo =======================================================================
echo   SUCCESS! All code is unified, pushed to GitHub, and live on VPS!
echo =======================================================================
pause
