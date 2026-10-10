@if not "%DGT_ALLOW_LEGACY_DEPLOY%"=="1" (echo DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate ^(scripts/production/dgt-deploy-gate.sh^) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. ^(Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.^) & exit /b 1)
@echo off
cd /d "%~dp0"
echo =======================================================================
echo   1-CLICK CODE SYNC ^& MULTI-VPS DEVELOPMENT DEPLOYMENT
echo   Repository: dgtllccom-cell/ACCOUNTS.DGT.LLC
echo   Active Branch: DEV (Development / Feature Branch)
echo   Target VPS: 72.60.209.121 ^& Second VPS (if specified in SECOND_VPS.txt)
echo =======================================================================
echo.

node deploy-multi-vps.mjs

echo.
echo =======================================================================
echo   DEVELOPMENT DEPLOYMENT PROCESS COMPLETED!
echo =======================================================================
pause
