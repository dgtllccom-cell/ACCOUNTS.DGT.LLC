@echo off
cd /d "%~dp0\.."
echo =======================================================================
echo   AUTOMATED 1-CLICK DEPLOYMENT & SUPABASE DATABASE SYNCHRONIZATION
echo   Repository : dgtllccom-cell/dht-nextjs
echo   Server     : 72.60.209.121
echo =======================================================================
echo.

echo [1/5] Synchronizing local schema migrations with central Supabase DB...
node scripts/sync-supabase-db.mjs

echo.
echo [2/5] Staging latest source code...
git remote set-url origin https://github.com/dgtllccom-cell/dht-nextjs.git 2>nul || git remote add origin https://github.com/dgtllccom-cell/dht-nextjs.git
git add .

echo.
echo [3/5] Committing changes...
git commit -m "feat(sync): automatic Supabase DB schema synchronization and code deploy" 2>nul

echo.
echo [4/5] Pushing to GitHub (dgtllccom-cell/dht-nextjs:main)...
git push origin main

echo.
echo [5/5] Deploying latest build to Production Server (72.60.209.121)...
node deployment/run-vps-fix.mjs

echo.
echo =======================================================================
echo   DEPLOYMENT & DATABASE SYNC COMPLETE!
echo =======================================================================
pause
