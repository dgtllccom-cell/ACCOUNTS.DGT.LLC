@echo off
echo ========================================================
echo   Extracting and Reviewing ERP-consolidated.zip
echo ========================================================
echo.
node scripts\extract-and-review-zip.mjs
echo.
echo Done! Check the _review-conflicts folder for the full report.
pause
