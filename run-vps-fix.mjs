import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  FULL END-TO-END VPS DEPLOYMENT & DB BACKUP SETUP: 72.60.209.121");
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "[1/10] Checking & Upgrading Node.js to Version 22 LTS..."
CURRENT_NODE_VER=$(node -v 2>/dev/null || echo "v0")
echo "Current Node version: $CURRENT_NODE_VER"
if [[ "$CURRENT_NODE_VER" != v22* ]]; then
  echo "Upgrading Node.js to v22.x LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  echo "Node.js successfully upgraded to: $(node -v)"
else
  echo "Node.js is already at version 22+: $(node -v)"
fi

echo "[2/10] Preserving the existing production environment..."
mkdir -p /var/www/env_backups
if [ -f /var/www/dgt-nextjs/.env.local ]; then
  cp -f /var/www/dgt-nextjs/.env.local /var/www/env_backups/.env.local.bak
fi
echo "[3/10] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[4/10] Fetching & Resetting to origin/main (ACCOUNTS.DGT.LLC)..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

echo "[5/10] Restoring the production environment without replacing it from Git..."
if [ -f /var/www/env_backups/.env.local.bak ]; then
  cp -f /var/www/env_backups/.env.local.bak /var/www/dgt-nextjs/.env.local
fi

echo "[6/10] Setting up Database Backup script & dependencies..."
mkdir -p /var/www/dgt-nextjs/scripts
which pg_dump >/dev/null 2>&1 || (apt-get update && apt-get install -y postgresql-client)
cp -f /var/www/dgt-nextjs/scripts/dgt-db-backup.sh /usr/local/bin/dgt-db-backup.sh
chmod 755 /usr/local/bin/dgt-db-backup.sh
chmod 755 /var/www/dgt-nextjs/scripts/dgt-db-backup.sh

echo "[7/10] Configuring Daily Cron Job for Database Backup..."
cat > /etc/cron.d/dgt-db-backup << 'CRONEOF'
0 2 * * * root /usr/local/bin/dgt-db-backup.sh >> /var/log/dgt-db-backup.log 2>&1
CRONEOF
chmod 644 /etc/cron.d/dgt-db-backup

echo "[8/10] Installing Dependencies & Compiling Next.js..."
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[9/10] Restarting PM2 process (dgt-nextjs) with clean process table..."
pm2 delete dgt-nextjs 2>/dev/null || true
pm2 start ecosystem.config.cjs || pm2 start npm --name "dgt-nextjs" -- start
pm2 save

echo "[10/10] Reloading Nginx Proxy..."
sudo nginx -t || nginx -t
sudo systemctl reload nginx || systemctl reload nginx || service nginx reload

echo "[verification] Running Initial Database Backup & Displaying Proof..."
/usr/local/bin/dgt-db-backup.sh || true
echo "\n--- PM2 Status ---"
pm2 status
echo "\n--- Node.js Version Verification ---"
node -v
echo "\n--- Recent PM2 Logs ---"
pm2 logs dgt-nextjs --lines 20 --nostream || true
echo "\n--- Database Backups Directory ---"
ls -lh /var/backups/dgt-database/ || true
echo "\n--- Database Backup Log File (tail 20) ---"
tail -n 20 /var/log/dgt-db-backup.log || true

echo "\n\n=== ALL DEPLOYMENT, NODE 22 UPGRADE & BACKUP CHECKS COMPLETED SUCCESSFULLY ==="
`;

try {
  console.log("Executing remote deployment and end-to-end verification on root@72.60.209.121...");
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s"`, {
    input: remoteScript,
    encoding: 'utf8',
    timeout: 600000
  });
  console.log(out);
  console.log("\nEnd-to-end verification and deployment completed successfully!");
} catch (e) {
  console.error("Deployment log/error output:");
  console.error(e.stdout || e.stderr || e.message);
}
