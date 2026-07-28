@echo off
cd /d "%~dp0"
echo Executing 1-Click Code Sync & VPS Deployment...
node deploy-vps-and-local.mjs
pause
