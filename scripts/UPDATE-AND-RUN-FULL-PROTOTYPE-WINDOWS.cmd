@echo off
setlocal EnableExtensions EnableDelayedExpansion
title DGT ERP FULL PROTOTYPE - UPDATE AND RUN
color 0A

echo ============================================================
echo DGT ERP FULL UI PROTOTYPE - UPDATE AND RUN
echo DESIGN / REVIEW ONLY - NO PRODUCTION WRITES
echo ============================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not available on this computer.
  echo Please send a photo of this window.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not available on this computer.
  echo Please send a photo of this window.
  pause
  exit /b 1
)

set "BRANCH=prototype-full-erp-20261008"
set "DEST=%LOCALAPPDATA%\DGT-ERP-Full-Prototype"
set "SOURCE="

if exist "B:\accounts.dgt.llc.code_project\ACCOUNTS.DGT.LLC\.git" set "SOURCE=B:\accounts.dgt.llc.code_project\ACCOUNTS.DGT.LLC"
if not defined SOURCE if exist "%USERPROFILE%\Desktop\ACCOUNTS.DGT.LLC\.git" set "SOURCE=%USERPROFILE%\Desktop\ACCOUNTS.DGT.LLC"
if not defined SOURCE if exist "%USERPROFILE%\OneDrive\Desktop\ACCOUNTS.DGT.LLC\.git" set "SOURCE=%USERPROFILE%\OneDrive\Desktop\ACCOUNTS.DGT.LLC"

echo Prototype folder:
echo   %DEST%
echo.

if not exist "%DEST%\.git" (
  echo [1/5] Creating a completely separate prototype copy...
  if defined SOURCE (
    git clone "%SOURCE%" "%DEST%"
  ) else (
    git clone https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git "%DEST%"
  )
  if errorlevel 1 goto :giterror
) else (
  echo [1/5] Separate prototype copy already exists.
)

cd /d "%DEST%"
if errorlevel 1 goto :foldererror

echo [2/5] Downloading the latest safe prototype fixes...
git fetch origin "%BRANCH%"
if errorlevel 1 goto :giterror

git checkout -B "%BRANCH%" "origin/%BRANCH%"
if errorlevel 1 goto :giterror

git reset --hard "origin/%BRANCH%"
if errorlevel 1 goto :giterror

echo [3/5] Clearing old prototype browser/build cache...
if exist ".next" rmdir /s /q ".next"

echo [4/5] Checking required packages...
if not exist "node_modules\next\package.json" (
  call npm install --legacy-peer-deps
  if errorlevel 1 goto :npmerror
)

echo [5/5] Starting DGT ERP Full Prototype...
echo.
echo IMPORTANT:
echo - This copy is separate from the main ERP working folder.
echo - Production database / ledger / stock / vouchers are NOT used.
echo - Keep this black window open while checking the prototype.
echo.

set "DGT_PROTOTYPE_MODE=1"
set "NEXT_PUBLIC_DGT_PROTOTYPE_MODE=1"
set "APP_ENV=development"
set "NEXT_PUBLIC_APP_ENV=development"
set "ALLOW_DEMO_AUTH=true"
set "DATABASE_URL="
set "NEXT_PUBLIC_SUPABASE_URL="
set "NEXT_PUBLIC_SUPABASE_ANON_KEY="
set "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="
set "SUPABASE_SECRET_KEY="
set "SUPABASE_SERVICE_ROLE_KEY="
set "PORT=8765"
set "HOSTNAME=0.0.0.0"
set "NEXT_TELEMETRY_DISABLED=1"

start "" powershell -NoProfile -WindowStyle Hidden -Command "$u='http://127.0.0.1:8765/prototype'; for($i=0;$i -lt 90;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ Start-Process $u; exit } } catch {}; Start-Sleep -Seconds 2 }"

call npm run dev
goto :end

:giterror
echo.
echo ERROR: Prototype update could not be downloaded.
echo Send a photo of this window to ChatGPT.
pause
exit /b 1

:foldererror
echo.
echo ERROR: Prototype folder could not be opened.
echo Send a photo of this window to ChatGPT.
pause
exit /b 1

:npmerror
echo.
echo ERROR: Required packages could not be installed.
echo Send a photo of this window to ChatGPT.
pause
exit /b 1

:end
endlocal
