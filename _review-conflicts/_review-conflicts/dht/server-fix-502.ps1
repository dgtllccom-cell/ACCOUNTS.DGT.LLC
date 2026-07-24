# =============================================================================
# server-fix-502.ps1  --  502 Bad Gateway: Diagnosis and Permanent Fix
# Server : 72.60.209.121
# App dir: /var/www/dgt-nextjs
# PM2 app: dgt-nextjs
# Run    : powershell -ExecutionPolicy Bypass -File server-fix-502.ps1
# =============================================================================

$SERVER   = "root@72.60.209.121"
$PM2_NAME = "dgt-nextjs"

function Invoke-SSH {
    param([string]$Script, [string]$Label = "")
    if ($Label) { Write-Host "`n========== $Label ==========" -ForegroundColor Cyan }
    $out = $Script | ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 $SERVER "bash -s" 2>&1
    $out | ForEach-Object { Write-Host $_ }
    return $out
}

Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "  502 Bad Gateway - Production Server Fix" -ForegroundColor Yellow
Write-Host "  Target: $SERVER" -ForegroundColor Yellow
Write-Host "================================================================`n" -ForegroundColor Yellow

# ─── STEP 1: Full Diagnostic ─────────────────────────────────────────────────
Write-Host "[1/6] Collecting server diagnostics..." -ForegroundColor Green

$diag = @"
echo '=== DISK ==='; df -h / | tail -1
echo ''; echo '=== RAM ==='; free -h | grep Mem
echo ''; echo '=== PM2 STATUS ==='; pm2 list 2>&1
echo ''; echo '=== PORT 3000 ==='; ss -tlnp | grep 3000 || echo 'NOTHING on port 3000'
echo ''; echo '=== NGINX ==='; systemctl is-active nginx
echo ''; echo '=== NODE PROCESSES ==='; ps aux | grep -E 'node|next' | grep -v grep || echo 'none'
echo ''; echo '=== NODE VERSION ==='; node -v && npm -v
echo ''; echo '=== PM2 ERROR LOG (last 50) ==='; pm2 logs $PM2_NAME --lines 50 --nostream --err 2>&1 | tail -55
echo ''; echo '=== PM2 OUT LOG (last 20) ==='; pm2 logs $PM2_NAME --lines 20 --nostream --out 2>&1 | tail -25
"@

ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 $SERVER $diag 2>&1

# ─── STEP 2: Restart PM2 ─────────────────────────────────────────────────────
Write-Host "`n[2/6] Restarting PM2 process '$PM2_NAME'..." -ForegroundColor Green
ssh -o StrictHostKeyChecking=no $SERVER "pm2 restart $PM2_NAME --update-env && pm2 save" 2>&1

Start-Sleep -Seconds 10

# ─── STEP 3: Verify port 3000 ────────────────────────────────────────────────
Write-Host "`n[3/6] Verifying app is listening on port 3000..." -ForegroundColor Green
ssh -o StrictHostKeyChecking=no $SERVER "ss -tlnp | grep 3000 || echo 'WARNING: App not on port 3000!'" 2>&1

# ─── STEP 4: PM2 startup (survive server reboots) ────────────────────────────
Write-Host "`n[4/6] Configuring PM2 auto-start on reboot..." -ForegroundColor Green
ssh -o StrictHostKeyChecking=no $SERVER "pm2 startup systemd -u root --hp /root 2>&1 | tail -3 && pm2 save 2>&1" 2>&1

# ─── STEP 5: Fix Nginx (raise timeouts, write clean config) ──────────────────
Write-Host "`n[5/6] Writing optimized Nginx config and reloading..." -ForegroundColor Green

# Write the nginx fix script to a temp file and push it
$nginxScript = @'
#!/bin/bash
# Backup existing config
cp -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.bak 2>/dev/null || true

# Write clean config
cat > /etc/nginx/sites-enabled/dgt-nextjs.conf << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;

    proxy_connect_timeout  120s;
    proxy_send_timeout     300s;
    proxy_read_timeout     300s;
    send_timeout           300s;

    proxy_buffer_size      128k;
    proxy_buffers          8 256k;
    proxy_busy_buffers_size 256k;

    location / {
        proxy_pass          http://127.0.0.1:3000;
        proxy_http_version  1.1;
        proxy_set_header    Upgrade     $http_upgrade;
        proxy_set_header    Connection  'upgrade';
        proxy_set_header    Host        $host;
        proxy_set_header    X-Real-IP   $remote_addr;
        proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_cache_bypass  $http_upgrade;
    }
}
NGINXEOF

# Remove the old default if it conflicts
rm -f /etc/nginx/sites-enabled/default

# Test config and reload
nginx -t 2>&1 && systemctl reload nginx && echo "Nginx reloaded successfully" || echo "ERROR: Nginx config test failed"
'@

$nginxScript | ssh -o StrictHostKeyChecking=no $SERVER "cat > /tmp/nginx_fix.sh && chmod +x /tmp/nginx_fix.sh && bash /tmp/nginx_fix.sh" 2>&1

# ─── STEP 6: Final health check ──────────────────────────────────────────────
Write-Host "`n[6/6] Running final health check..." -ForegroundColor Green
Start-Sleep -Seconds 5

$finalCheck = @"
echo '=== FINAL PM2 STATUS ===' && pm2 list 2>&1
echo '' && echo '=== PORT 3000 ===' && ss -tlnp | grep 3000 || echo 'PROBLEM: not listening!'
echo '' && echo '=== NGINX ===' && systemctl is-active nginx
echo '' && echo '=== CURL LOCAL ===' && curl -s -o /dev/null -w 'HTTP %{http_code} in %{time_total}s' http://127.0.0.1:3000 2>&1 || echo 'curl failed'
echo '' && echo '=== LAST PM2 ERRORS ===' && pm2 logs $PM2_NAME --lines 10 --nostream --err 2>&1 | tail -12
"@

ssh -o StrictHostKeyChecking=no $SERVER $finalCheck 2>&1

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  Done! If the app is still down, run a full rebuild:" -ForegroundColor Green
Write-Host "  ssh root@72.60.209.121 'cd /var/www/dgt-nextjs && git pull && npm install && npm run build && pm2 restart dgt-nextjs'" -ForegroundColor Yellow
Write-Host "================================================================`n" -ForegroundColor Green

Read-Host "Press Enter to exit"
