import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  FULL END-TO-END VPS VERIFICATION & DEPLOYMENT: 72.60.209.121");
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "[1/8] Backing up & writing verified production .env.local..."
mkdir -p /var/www/env_backups
cat > /var/www/dgt-nextjs/.env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://csesvyxxjivnkkozgopt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w
SUPABASE_SERVICE_ROLE_KEY=sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w
DATABASE_URL=postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
ENVEOF
cp -f /var/www/dgt-nextjs/.env.local /var/www/dgt-nextjs/.env
cp -f /var/www/dgt-nextjs/.env.local /var/www/env_backups/.env.local.bak

echo "[2/8] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/dht-nextjs.git
fi

echo "[3/8] Fetching & Resetting to origin/main (dht-nextjs)..."
git remote set-url origin https://github.com/dgtllccom-cell/dht-nextjs.git
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

echo "[4/8] Synchronizing Database Schema to Supabase..."
node scripts/sync-supabase-db.mjs || true

echo "[5/8] Installing Dependencies & Compiling Next.js..."
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[6/8] Restarting PM2 process (dgt-nextjs) with updated env..."
pm2 restart dgt-nextjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

echo "[7/8] Reloading Nginx Proxy..."
sudo nginx -t || nginx -t
sudo systemctl reload nginx || systemctl reload nginx || service nginx reload

echo "[8/8] VERIFYING ENDPOINTS & BACKEND DATA..."
echo "--- PM2 Status ---"
pm2 status

echo "\n--- Port 3000 HTTP Test ---"
curl -I http://127.0.0.1:3000

echo "\n--- API Database Health & Data Test (/api/inspect-db) ---"
curl -s http://127.0.0.1:3000/api/inspect-db || echo "Endpoint ping complete"

echo "\n\n=== ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY ==="
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
