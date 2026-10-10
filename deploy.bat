@if not "%DGT_ALLOW_LEGACY_DEPLOY%"=="1" (echo DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate ^(scripts/production/dgt-deploy-gate.sh^) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. ^(Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.^) & exit /b 1)
@echo off
echo ===============================================================
echo   STARTING 1-CLICK AUTOMATIC VPS DEPLOYMENT: 72.60.209.121
echo ===============================================================
node deploy-vps-and-local.mjs
