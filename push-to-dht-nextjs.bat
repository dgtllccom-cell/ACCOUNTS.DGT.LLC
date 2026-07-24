@echo off
cd /d "%~dp0"
echo =======================================================================
echo   TRANSFER ALL CODE TO GITHUB REPOSITORY: dgtllccom-cell/ACCOUNTS.DGT.LLC
echo =======================================================================
echo.

echo [1/5] Setting Git remote origin to dgtllccom-cell/ACCOUNTS.DGT.LLC.git...
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git

echo.
echo [2/5] Staging all files...
git add .

echo.
echo [3/5] Committing complete application code...
git commit -m "feat(sync): transfer complete code and Supabase fixes to ACCOUNTS.DGT.LLC repository"

echo.
echo [4/5] Pushing to https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git (main)...
git push -u origin main

echo.
echo [5/5] Updating production server (72.60.209.121)...
node run-vps-fix.mjs

echo.
echo =======================================================================
echo   SUCCESS! All code has been transferred to dgtllccom-cell/ACCOUNTS.DGT.LLC!
echo =======================================================================
pause
