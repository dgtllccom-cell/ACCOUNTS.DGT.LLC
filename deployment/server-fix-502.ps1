# =============================================================================
# server-fix-502.ps1  --  Direct SCP Upload & VPS Fix Script
# Server : 72.60.209.121
# App dir: /var/www/dgt-nextjs
# PM2 app: dgt-nextjs
# Run    : powershell -ExecutionPolicy Bypass -File server-fix-502.ps1
# =============================================================================

$SERVER = "root@72.60.209.121"

Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "  502 Bad Gateway - Direct Code Upload & Server Recovery" -ForegroundColor Yellow
Write-Host "  Target: $SERVER" -ForegroundColor Yellow
Write-Host "================================================================`n" -ForegroundColor Yellow

# Step A: Upload fixed source files directly to VPS via SCP
Write-Host "[1/6] Uploading fixed source files directly to production server..." -ForegroundColor Green
scp -o StrictHostKeyChecking=no features/journal/components/purchase-order-payment-journal.tsx root@72.60.209.121:/var/www/dgt-nextjs/features/journal/components/purchase-order-payment-journal.tsx
scp -o StrictHostKeyChecking=no features/purchases/components/purchase-booking-journal-report-view.tsx root@72.60.209.121:/var/www/dgt-nextjs/features/purchases/components/purchase-booking-journal-report-view.tsx
scp -o StrictHostKeyChecking=no app/api/erp/purchases/orders/[id]/route.ts root@72.60.209.121:/var/www/dgt-nextjs/app/api/erp/purchases/orders/[id]/route.ts
scp -o StrictHostKeyChecking=no ecosystem.config.cjs root@72.60.209.121:/var/www/dgt-nextjs/ecosystem.config.cjs
scp -o StrictHostKeyChecking=no scripts/healthcheck.sh root@72.60.209.121:/var/www/dgt-nextjs/scripts/healthcheck.sh

$unifiedScript = @'
set -e

echo ""
echo "[2/6] Checking and upgrading Node.js to Node.js 22 LTS..."
CURRENT_NODE=$(node -v 2>/dev/null || echo "v0.0.0")
NODE_MAJOR=$(echo "$CURRENT_NODE" | cut -d'.' -f1 | tr -d 'v')

if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "Upgrading to Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    echo "Node.js upgrade successful: $(node -v)"
else
    echo "Node.js version compliant: $(node -v)"
fi

echo ""
echo "[3/6] Configuring 2GB Swap memory..."
if [ $(free -m | awk '/Swap:/ {print $2}') -eq 0 ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap enabled."
else
    echo "Swap space verified."
fi

echo ""
echo "[4/6] Verifying environment files..."
mkdir -p /var/www/env_backups
if [ ! -f "/var/www/dgt-nextjs/.env.local" ] && [ ! -f "/var/www/dgt-nextjs/.env" ]; then
    if [ -f "/var/www/env_backups/.env.local.bak" ]; then
        cp /var/www/env_backups/.env.local.bak /var/www/dgt-nextjs/.env.local
    elif [ -f "/var/www/env_backups/.env.bak" ]; then
        cp /var/www/env_backups/.env.bak /var/www/dgt-nextjs/.env.local
    fi
fi

if [ -f "/var/www/dgt-nextjs/.env.local" ]; then
    cp -f /var/www/dgt-nextjs/.env.local /var/www/dgt-nextjs/.env 2>/dev/null || true
    cp -f /var/www/dgt-nextjs/.env.local /var/www/env_backups/.env.local.bak 2>/dev/null || true
    chmod 600 /var/www/dgt-nextjs/.env.local /var/www/dgt-nextjs/.env 2>/dev/null || true
fi

echo ""
echo "[5/6] Compiling Next.js production build..."
cd /var/www/dgt-nextjs
npm install

if ! NODE_OPTIONS='--max-old-space-size=4096' npm run build; then
    echo "================================================================"
    echo " ERROR: Production build failed!"
    echo "================================================================"
    exit 1
fi

if [ ! -d "/var/www/dgt-nextjs/.next" ]; then
    echo "ERROR: Production build failed! .next directory missing."
    exit 1
fi
echo "SUCCESS: Production build completed cleanly."

echo ""
echo "[6/6] Launching PM2 process & Nginx proxy..."
pm2 delete dgt-nextjs 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

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

rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Install crontab health check
chmod +x /var/www/dgt-nextjs/scripts/healthcheck.sh
(crontab -l 2>/dev/null | grep -v 'healthcheck.sh'; echo "* * * * * /bin/bash /var/www/dgt-nextjs/scripts/healthcheck.sh >> /var/log/dgt-healthcheck.log 2>&1") | crontab -
pm2 startup systemd -u root --hp /root 2>/dev/null || true
pm2 save

echo ""
echo "=== VERIFICATION ==="
echo "Node Version: $(node -v)"
echo "PM2 Status:"
pm2 list
echo ""
echo "Port 3000 Listener:"
ss -tlnp | grep 3000 || (echo "ERROR: Port 3000 not listening!" && exit 1)
echo ""
echo "Local HTTP Response:"
curl -I http://127.0.0.1:3000 || (echo "ERROR: Local HTTP check failed!" && exit 1)
echo ""
echo "SUCCESS: ERP application is live on port 3000!"
'@

$unifiedScript | ssh -o StrictHostKeyChecking=no $SERVER "bash -s"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n================================================================" -ForegroundColor Red
    Write-Host "  BUILD OR DEPLOYMENT FAILED ON PRODUCTION SERVER." -ForegroundColor Red
    Write-Host "================================================================`n" -ForegroundColor Red
    exit 1
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  Execution Complete & Verified! Production URL: http://72.60.209.121" -ForegroundColor Green
Write-Host "================================================================`n" -ForegroundColor Green
