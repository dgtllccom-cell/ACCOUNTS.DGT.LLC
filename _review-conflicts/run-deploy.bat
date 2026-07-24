@echo off
cd /d "%~dp0"
title Production Deployment - DGT ERP (72.60.209.121)
node deploy-and-verify.js
pause
