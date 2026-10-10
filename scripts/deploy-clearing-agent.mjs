if (!process.env.DGT_ALLOW_LEGACY_DEPLOY) { console.error("DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate (scripts/production/dgt-deploy-gate.sh) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. (Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.)"); process.exit(1); }
import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  DEPLOYING TO VPS PRODUCTION (dgt-nextjs) & DEV (dgt-dev)");
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "[1/6] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

echo "[2/6] Fetching and checking out latest main..."
git fetch origin main
git checkout -f -B main origin/main
git reset --hard origin/main
echo "Current commit:"
git log -1 --oneline

echo "[3/6] Running prebuild validation..."
npm run prebuild

echo "[4/6] Building Next.js application..."
rm -rf .next
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[5/6] Restarting PM2 process dgt-nextjs..."
pm2 restart dgt-nextjs --update-env
pm2 save

echo "[6/6] Verifying HTTP response..."
sleep 3
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:3000/dashboard/clearing-agent/customer-order || true

echo "=== Syncing dgt-dev environment ==="
cd /var/www/dgt-dev
git fetch origin main
git checkout -f -B main origin/main
git reset --hard origin/main
NODE_OPTIONS='--max-old-space-size=4096' npm run build || true
pm2 restart dgt-dev --update-env || true
pm2 save || true

pm2 status
echo "SUCCESS: Deployment completed!"
`;

try {
  execSync(`ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=60 ${SERVER} "bash -s"`, {
    input: remoteScript.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    encoding: 'utf8',
    timeout: 900000,
    stdio: 'inherit'
  });
  console.log("\n✅ Deployment completed successfully!");
} catch (e) {
  console.error("❌ Deployment error:", e.message);
  process.exit(1);
}
