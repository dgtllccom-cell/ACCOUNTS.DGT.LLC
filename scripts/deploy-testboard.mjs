import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  DEPLOYING TO TEST BOARD (dgt-dev): dev.72-60-209-121.sslip.io");
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "[1/5] Navigating to /var/www/dgt-dev..."
cd /var/www/dgt-dev

echo "[2/5] Fetching and checking out latest journal-print-standard..."
git fetch origin journal-print-standard
git checkout -f -B journal-print origin/journal-print-standard
git reset --hard origin/journal-print-standard

echo "[3/5] Running prebuild validation..."
npm run prebuild

echo "[4/5] Building Next.js application..."
rm -rf .next
NODE_OPTIONS='--max-old-space-size=3584' npm run build

echo "[5/5] Restarting PM2 process dgt-dev..."
pm2 restart dgt-dev --update-env
pm2 save

echo "=== Verifying HTTP response ==="
sleep 3
curl -k -s -o /dev/null -w "%{http_code}" https://dev.72-60-209-121.sslip.io/dashboard/crm || true
echo ""
pm2 status
`;

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=60 ${SERVER} "bash -s"`, {
    input: remoteScript.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    encoding: 'utf8',
    timeout: 900000,
    stdio: 'inherit'
  });
  console.log("\n✅ Test board deployment completed successfully!");
} catch (e) {
  console.error("❌ Test board deployment error:", e.message);
  process.exit(1);
}
