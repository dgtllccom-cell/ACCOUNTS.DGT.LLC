@echo off
cd /d "%~dp0"
echo ========================================================
echo   Extracting Your Design Studio.zip
echo ========================================================
echo.
node scripts\extract-design-studio.mjs
echo.
echo Done! Files extracted to _design_studio folder.
pause
