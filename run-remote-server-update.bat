@echo off
echo ========================================================
echo   Running PM2 Update on Production Server (72.60.209.121)
echo ========================================================
echo.
ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && cp package.json /root/dgt-nextjs-package.json.backup && npm pkg set scripts.start=\"next start -p 3000\" && pm2 delete dgt-nextjs && pm2 start npm --name dgt-nextjs -- start && pm2 save && curl -I http://127.0.0.1:3000"
echo.
echo ========================================================
echo   Finished!
echo ========================================================
pause
