@if not "%DGT_ALLOW_LEGACY_DEPLOY%"=="1" (echo DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate ^(scripts/production/dgt-deploy-gate.sh^) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. ^(Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.^) & exit /b 1)
@echo off
cd /d "%~dp0"
echo =======================================================================
echo   1-CLICK CODE SYNC ^& VPS PRODUCTION DEPLOYMENT
echo   Repository: dgtllccom-cell/ACCOUNTS.DGT.LLC
echo   Target VPS: 72.60.209.121
echo =======================================================================
echo.

if exist ".git\index.lock" del /f /q ".git\index.lock"
node deploy-vps-and-local.mjs

echo.
echo =======================================================================
echo   DEPLOYMENT PROCESS COMPLETE!
echo =======================================================================
pause
