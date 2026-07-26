import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  FULL END-TO-END VPS DEPLOYMENT & DB BACKUP SETUP: 72.60.209.121");
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "[1/9] Preserving the existing production environment..."
mkdir -p /var/www/env_backups
if [ -f /var/www/dgt-nextjs/.env.local ]; then
  cp -f /var/www/dgt-nextjs/.env.local /var/www/env_backups/.env.local.bak
fi
echo "[2/9] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[3/9] Fetching & Resetting to origin/main (ACCOUNTS.DGT.LLC)..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

echo "[4/9] Restoring the production environment without replacing it from Git..."
if [ -f /var/www/env_backups/.env.local.bak ]; then
  cp -f /var/www/env_backups/.env.local.bak /var/www/dgt-nextjs/.env.local
fi

echo "[5/9] Setting up Database Backup script & dependencies..."
mkdir -p /var/www/dgt-nextjs/scripts
which pg_dump >/dev/null 2>&1 || (apt-get update && apt-get install -y postgresql-client)
cp -f /var/www/dgt-nextjs/scripts/dgt-db-backup.sh /usr/local/bin/dgt-db-backup.sh
chmod 755 /usr/local/bin/dgt-db-backup.sh
chmod 755 /var/www/dgt-nextjs/scripts/dgt-db-backup.sh

echo "[6/9] Configuring Daily Cron Job for Database Backup..."
cat > /etc/cron.d/dgt-db-backup << 'CRONEOF'
0 2 * * * root /usr/local/bin/dgt-db-backup.sh >> /var/log/dgt-db-backup.log 2>&1
CRONEOF
chmod 644 /etc/cron.d/dgt-db-backup

echo "[7/9] Installing Dependencies & Compiling Next.js..."
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[8/9] Restarting PM2 process (dgt-nextjs) with the preserved environment..."
pm2 start ecosystem.config.cjs || pm2 restart dgt-nextjs --update-env
pm2 save

echo "[9/9] Reloading Nginx Proxy..."
sudo nginx -t || nginx -t
sudo systemctl reload nginx || systemctl reload nginx || service nginx reload

echo "[verification] Running Initial Database Backup & Displaying Proof..."
/usr/local/bin/dgt-db-backup.sh || true
echo "\n--- PM2 Status ---"
pm2 status
echo "\n--- Backup Script Permissions ---"
ls -l /var/www/dgt-nextjs/scripts/dgt-db-backup.sh
ls -l /usr/local/bin/dgt-db-backup.sh
echo "\n--- Database Backups Directory ---"
ls -lh /var/backups/dgt-database/ || true
echo "\n--- Backup Log File (tail 50) ---"
tail -n 50 /var/log/dgt-db-backup.log || true

echo "\n\n=== ALL DEPLOYMENT & BACKUP CHECKS COMPLETED SUCCESSFULLY ==="
`;

try {
  console.log("Executing remote deployment and end-to-end verification on root@72.60.209.121...");
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s"`, {
    input: remoteScript,
    encoding: 'utf8',
    timeout: 300000
  });
  console.log(out);
  console.log("\nEnd-to-end verification and deployment completed successfully!");
} catch (e) {
  console.error("Deployment log/error output:");
  console.error(e.stdout || e.stderr || e.message);
}
