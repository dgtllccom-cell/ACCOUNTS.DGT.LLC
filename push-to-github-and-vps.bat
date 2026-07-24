@echo off
cd /d "%~dp0"
echo =======================================================================
echo   1-CLICK GITHUB PUSH & SERVER DEPLOYMENT (dgtllccom-cell/ACCOUNTS.DGT.LLC)
echo =======================================================================
echo.

echo [1/4] Staging modified files...
git add .env.local .env lib/db/client.ts lib/supabase/config.ts features/purchases/components/purchase-order-management-dashboard.tsx lib/reports/open-purchase-a4-report-window.ts lib/reports/open-trade-document-window.ts lib/reports/open-user-a4-report-window.ts run-vps-fix.mjs double-click-to-fix-502.bat

echo.
echo [2/4] Committing changes...
git commit -m "feat(system): sync Supabase DB connection resilience and A4 print store"

echo.
echo [3/4] Pushing to GitHub (dgtllccom-cell/ACCOUNTS.DGT.LLC)...
git push origin main

echo.
echo [4/4] Executing Remote Server Recovery (72.60.209.121)...
node run-vps-fix.mjs

echo.
echo =======================================================================
echo   COMPLETED! Code is live on GitHub and Server 72.60.209.121 is restored.
echo =======================================================================
pause
