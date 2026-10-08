@echo off
title DGT ERP FULL PROTOTYPE
cd /d "%~dp0.."
echo ============================================================
echo DGT ERP FULL UI PROTOTYPE - DESIGN ONLY
echo No production database / ledger / stock / VPS writes
echo ============================================================
echo.
node scripts\prototype-dev.cjs
pause
