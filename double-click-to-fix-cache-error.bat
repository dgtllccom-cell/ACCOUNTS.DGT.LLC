@echo off
cd /d "%~dp0"
echo ================================================================
echo   NEXT.JS CACHE & WEBPACK CHUNK ERROR CLEANER
echo   Fixing "Cannot find module ./5873.js" and stale build files
echo ================================================================
echo.

if exist ".next" (
    echo Deleting corrupt .next build directory...
    rmdir /s /q ".next"
    echo .next directory deleted.
) else (
    echo .next directory does not exist.
)

echo.
echo ================================================================
echo   Cache cleared! You can now restart your dev server (npm run dev)
echo ================================================================
pause
