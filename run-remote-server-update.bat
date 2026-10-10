@if not "%DGT_ALLOW_LEGACY_DEPLOY%"=="1" (echo DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate ^(scripts/production/dgt-deploy-gate.sh^) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. ^(Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.^) & exit /b 1)
@echo off
echo =======================================================================
echo   Safe Read-Only VPS Inspection (72.60.209.121)
echo =======================================================================
echo.
ssh -o StrictHostKeyChecking=no root@72.60.209.121 "ls -la /var/www/ && echo '--- PM2 STATUS ---' && pm2 status && echo '--- ENV CONFIG CHECK ---' && grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL)' /var/www/dgt-nextjs/.env.local 2>/dev/null | sed 's/=.*/= [CONFIGURED]/'"
echo.
echo =======================================================================
pause
