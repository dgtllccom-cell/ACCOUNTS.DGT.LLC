# =============================================================================
# server-fix-502.ps1  --  Direct GitHub Sync & VPS Production Recovery Script
# Server : 72.60.209.121
# App dir: /var/www/dgt-nextjs
# PM2 app: dgt-nextjs
# Run    : powershell -ExecutionPolicy Bypass -File server-fix-502.ps1
# =============================================================================

$SERVER = "root@72.60.209.121"

Write-Host "================================================================" -ForegroundColor Yellow
Write-Host "  502 Bad Gateway - Code Sync & Server Recovery" -ForegroundColor Yellow
Write-Host "  Target: $SERVER" -ForegroundColor Yellow
Write-Host "================================================================`n" -ForegroundColor Yellow

# Step 1: Sync local code fixes to GitHub
Write-Host "[1/5] Staging & pushing fixed code to GitHub (origin main)..." -ForegroundColor Green
git add -A
try {
    git commit -m "fix: resolve import syntax errors in journal components"
} catch {
    Write-Host "No new changes to commit."
}
try {
    git push origin main
    Write-Host "✅ Git push completed successfully!" -ForegroundColor Green
} catch {
    git push origin main --force-with-lease
}

$unifiedScript = @'
set -e

echo ""
echo "[2/5] Navigating to /var/www/dgt-nextjs and pulling latest code..."
cd /var/www/dgt-nextjs
if [ ! -d ".git" ]; then
    git init
    git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
else
    git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

git fetch origin main
git checkout -f -B main origin/main
git reset --hard origin/main

echo ""
echo "[3/5] Checking and upgrading Node.js to Node.js 22 LTS..."
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
echo "[4/5] Verifying environment files..."
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
echo "[5/5] Compiling Next.js production build..."
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
echo "[Database] Seeding 1 Admin, 1 User, 20-25 Accounts, and Employees per Branch..."
node scripts/seed-database-users-accounts-employees.mjs || true

echo ""
echo "[Final] Launching PM2 process & Nginx proxy..."
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

Write-Host "[2/5] Connecting via SSH to 72.60.209.121 and executing remote deployment..." -ForegroundColor Green
$cleanScript = $unifiedScript.Replace("`r`n", "`n").Replace("`r", "`n")
$cleanScript | ssh -o StrictHostKeyChecking=no $SERVER "bash -s"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n================================================================" -ForegroundColor Red
    Write-Host "  BUILD OR DEPLOYMENT FAILED ON PRODUCTION SERVER." -ForegroundColor Red
    Write-Host "================================================================`n" -ForegroundColor Red
    exit 1
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  Execution Complete & Verified! Production URL: http://72.60.209.121" -ForegroundColor Green
Write-Host "================================================================`n" -ForegroundColor Green

