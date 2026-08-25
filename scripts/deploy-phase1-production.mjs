import { execSync } from 'child_process';
import fs from 'fs';

const BRANCH = "main";
const SERVERS = ["root@72.60.209.121"];

if (fs.existsSync('SECOND_VPS.txt')) {
  const lines = fs.readFileSync('SECOND_VPS.txt', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine && !cleanLine.startsWith('#') && !SERVERS.includes(`root@${cleanLine}`)) {
      SERVERS.push(`root@${cleanLine}`);
    }
  }
}

console.log("===============================================================");
console.log("  DOCUMENT MANAGEMENT PHASE 1: VPS DEPLOYMENT & PROD MIGRATION");
console.log("  Branch:", BRANCH);
console.log("  Servers:", SERVERS.join(", "));
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "=== [1/6] Navigating to /var/www/dgt-nextjs ==="
cd /var/www/dgt-nextjs

echo "=== [2/6] Fetching and checking out latest ${BRANCH} ==="
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin ${BRANCH}
git checkout -f -B ${BRANCH} origin/${BRANCH}
git reset --hard origin/${BRANCH}
echo "Current commit:"
git log -1 --oneline

echo "=== [3/6] Applying Phase 1 Migrations to Production Database ==="
node scripts/apply-prod-document-migration.mjs

echo "=== [4/6] Installing dependencies ==="
npm install --include=dev

echo "=== [5/6] Building Next.js application ==="
rm -rf .next
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "=== [6/6] Restarting PM2 process ==="
pm2 restart dgt-nextjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

echo "Checking PM2 status:"
pm2 status

echo "Checking HTTP health on localhost:3000:"
sleep 3
curl -I -s http://localhost:3000/dashboard/documents | head -n 5 || true

echo "=== DEPLOYMENT AND VERIFICATION FINISHED SUCCESSFULLY ON VPS ==="
`;

for (const server of SERVERS) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`🚀 Executing Production Deployment on: ${server}`);
  console.log(`---------------------------------------------------------------`);
  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no ${server} "bash -s"`, {
      input: remoteScript,
      encoding: 'utf8',
      timeout: 900000
    });
    console.log(out);
    console.log(`✅ Successfully deployed and migrated ${server}`);
  } catch (e) {
    console.error(`❌ Deployment failed on ${server}:`);
    console.error(e.stdout || e.stderr || e.message);
    process.exit(1);
  }
}

console.log("\n===============================================================");
console.log("  🎉 FULL PRODUCTION VPS DEPLOYMENT & VERIFICATION COMPLETE!");
console.log("===============================================================");
