@echo off
echo =======================================================================
echo   Safe Read-Only VPS Inspection (72.60.209.121)
echo =======================================================================
echo.
ssh -o StrictHostKeyChecking=no root@72.60.209.121 "ls -la /var/www/ && echo '--- PM2 STATUS ---' && pm2 status && echo '--- ENV CONFIG CHECK ---' && grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL)' /var/www/dgt-nextjs/.env.local 2>/dev/null | sed 's/=.*/= [CONFIGURED]/'"
echo.
echo =======================================================================
pause
