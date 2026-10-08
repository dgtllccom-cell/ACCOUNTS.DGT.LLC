@echo off
title DGT ERP FULL PROTOTYPE
cd /d "%~dp0.."

echo ============================================================
echo DGT ERP FULL UI PROTOTYPE
echo REAL ERP UI SOURCE - DESIGN / REVIEW ONLY
echo NO PRODUCTION DB - NO LEDGER/STOCK/VOUCHER WRITES
echo ============================================================
echo.
echo Keep this window OPEN while checking the prototype.
echo The browser will open automatically when the ERP is ready.
echo.
node scripts\prototype-dev.cjs
echo.
echo Prototype stopped.
pause
