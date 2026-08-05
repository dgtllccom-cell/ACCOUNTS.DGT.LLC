@echo off
cd /d "%~dp0"
echo =======================================================================
echo   1-CLICK GITHUB PUSH ^& SERVER DEPLOYMENT (dgtllccom-cell/ACCOUNTS.DGT.LLC)
echo =======================================================================
echo.

echo [1/5] Removing any stale git lock files...
if exist ".git\index.lock" del /f /q ".git\index.lock"

echo.
echo [2/5] Staging all modified files...
git add .

echo.
echo [3/5] Committing changes...
git commit -m "fix(auth): resolve Super Admin login fallback and session verification"

echo.
echo [4/5] Pulling remote updates ^& Pushing to GitHub (dgtllccom-cell/ACCOUNTS.DGT.LLC)...
git pull origin main --rebase
git push origin main

echo.
echo [5/5] Executing Remote Server Recovery (72.60.209.121)...
node run-vps-fix.mjs

echo.
echo =======================================================================
echo   COMPLETED! Code is live on GitHub and Server 72.60.209.121 is restored.
echo =======================================================================
pause

