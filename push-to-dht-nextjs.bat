@if not "%DGT_ALLOW_LEGACY_DEPLOY%"=="1" (echo DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate ^(scripts/production/dgt-deploy-gate.sh^) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. ^(Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.^) & exit /b 1)
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
