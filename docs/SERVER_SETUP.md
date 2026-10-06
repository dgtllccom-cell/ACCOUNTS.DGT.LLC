# Production Server Architecture & Setup Guide

This guide details the server configuration and dependencies for **ACCOUNTS.DGT.LLC** on Production VPS `72.60.209.121`.

---

## Server Specifications

- **OS**: Ubuntu 22.04 / 24.04 LTS
- **Node.js**: v22 LTS
- **Process Manager**: PM2 (`ecosystem.config.cjs`)
- **Web Server / Reverse Proxy**: Nginx
- **Database**: Central Supabase PostgreSQL Instance (Pooler port 6543)
- **Swap Memory**: 2GB SWAP file enabled for stable compilation

---

## Initial Server Provisioning Steps

```bash
# 1. Update system packages & install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx git pm2

# 2. Configure 2GB Swap Memory (Prevents out-of-memory during Next.js build)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 3. Clone Repository
mkdir -p /var/www
cd /var/www
git clone https://github.com/dgtllccom-cell/dht-nextjs.git dgt-nextjs
cd dgt-nextjs

# 4. Configure Environment Variables
cp env_backups/.env.production.example .env.local
# Edit .env.local with real production DB & Supabase keys

# 5. Build Application
npm install
npm run build

# 6. Start PM2 Process & Configure Nginx
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## Nginx Proxy Configuration (`/etc/nginx/sites-enabled/dgt-nextjs.conf`)

```nginx
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
    }
}
```
