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
