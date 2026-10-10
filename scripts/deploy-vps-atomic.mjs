if (!process.env.DGT_ALLOW_LEGACY_DEPLOY) { console.error("DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate (scripts/production/dgt-deploy-gate.sh) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. (Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.)"); process.exit(1); }
import { execSync } from 'child_process';
import fs from 'fs';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  DEPLOYING UNIFIED CUSTOMER ORDER MODULE TO VPS PRODUCTION");
console.log("  Target: " + SERVER);
console.log("===============================================================\n");

const remoteScript = `#!/usr/bin/env bash
set -e

echo "[VPS 1/6] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

echo "[VPS 2/6] Fetching and checking out latest main..."
git fetch origin main
git checkout -f -B main origin/main
git reset --hard origin/main
echo "Latest Commit on VPS:"
git log -1 --oneline

echo "[VPS 3/6] Running prebuild validation..."
npm run prebuild

echo "[VPS 4/6] Executing safe isolated build and atomic swap for Production (dgt-nextjs)..."
PM2_APP_NAME="dgt-nextjs" bash scripts/safe-build-deploy.sh

echo "[VPS 5/6] Updating dev environment (/var/www/dgt-dev)..."
if [ -d "/var/www/dgt-dev" ]; then
  cd /var/www/dgt-dev
  git fetch origin main
  git checkout -f -B main origin/main
  git reset --hard origin/main
  PM2_APP_NAME="dgt-dev" bash scripts/safe-build-deploy.sh || true
fi

echo "[VPS 6/6] Reloading Nginx and saving PM2..."
pm2 save
sudo systemctl reload nginx || systemctl reload nginx 2>/dev/null || true

echo ""
echo "--- Verifying Production Service Status ---"
pm2 status
curl -s -o /dev/null -w "Clearing Customer Order Route HTTP Status: %{http_code}\\n" http://127.0.0.1:3000/dashboard/clearing-agent/customer-order || true

echo ""
echo "==============================================================="
echo "  VPS DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "==============================================================="
`;

try {
  // 1. Write remote script to /tmp/deploy-unified-order.sh
  console.log("Uploading deployment instructions to VPS...");
  const tempFile = 'scripts/.tmp-deploy-remote.sh';
  fs.writeFileSync(tempFile, remoteScript.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'utf8');
  execSync(`scp -o StrictHostKeyChecking=no ${tempFile} ${SERVER}:/tmp/deploy-unified-order.sh`, { stdio: 'inherit' });
  try { fs.unlinkSync(tempFile); } catch {}

  // 2. Execute script on VPS
  console.log("Executing deployment on VPS...\n");
  execSync(`ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=60 ${SERVER} "chmod +x /tmp/deploy-unified-order.sh && /tmp/deploy-unified-order.sh"`, {
    stdio: 'inherit',
    timeout: 1200000
  });
  console.log("\n✅ All VPS deployment steps succeeded!");
} catch (e) {
  console.error("❌ VPS deployment failed:", e.message);
  process.exit(1);
}

