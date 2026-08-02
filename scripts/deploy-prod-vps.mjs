import { execSync } from 'child_process';
import fs from 'fs';

const BRANCH = "main";

const SERVERS = [
  "root@72.60.209.121",
];

if (fs.existsSync('SECOND_VPS.txt')) {
  const lines = fs.readFileSync('SECOND_VPS.txt', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine && !cleanLine.startsWith('#')) {
      if (!SERVERS.includes(`root@${cleanLine}`)) {
        SERVERS.push(`root@${cleanLine}`);
      }
    }
  }
}

console.log("===============================================================");
console.log(`  OPTION 3: PROMOTE DEV TO [MAIN] & DEPLOY TO PRODUCTION VPS`);
console.log("  Target Servers:", SERVERS.join(", "));
console.log("===============================================================\n");

try {
  if (fs.existsSync('.git/index.lock')) {
    try { fs.unlinkSync('.git/index.lock'); } catch {}
  }
  execSync('git add -A', { stdio: 'inherit' });
  try {
    execSync('git -c user.name="DeployBot" -c user.email="deploy@damaan.local" commit -m "fix: location sync route and currency auto-set"', { stdio: 'inherit' });
  } catch (e) {
    console.log("Commit skipped or already clean");
  }
  execSync('git branch -M main', { stdio: 'inherit' });
  execSync('git push -u origin main', { stdio: 'inherit' });
  console.log("✅ GitHub main branch updated successfully!\n");
} catch (err) {
  console.error("Git merge/push error:", err.message);
}

const remoteScript = `
set -e

echo "[VPS 1/5] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[VPS 2/5] Fetching & checking out ${BRANCH} branch..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin ${BRANCH}
git checkout -f -B ${BRANCH} origin/${BRANCH}
git reset --hard origin/${BRANCH}

echo "[VPS 3/5] Installing dependencies..."
npm install --include=dev

echo "[VPS 4/5] Building Next.js application..."
rm -rf .next
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[VPS 5/5] Restarting PM2 process and reloading Nginx..."
pm2 delete dgt-nextjs 2>/dev/null || true
pm2 start ecosystem.config.cjs || pm2 start npm --name "dgt-nextjs" -- start
pm2 save
sudo systemctl reload nginx || systemctl reload nginx 2>/dev/null || true
echo "[VPS 6/6] Populating official location master tables in VPS database..."
node scripts/populate-vps-locations.mjs || true

echo "=== PRODUCTION DEPLOYMENT COMPLETED ON THIS VPS (${BRANCH} branch) ==="
`;

for (const server of SERVERS) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`🚀 Deploying PRODUCTION [${BRANCH}] branch to Server: ${server}`);
  console.log(`---------------------------------------------------------------`);
  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no ${server} "bash -s"`, {
      input: remoteScript,
      encoding: 'utf8',
      timeout: 600000
    });
    console.log(out);
    console.log(`✅ Successfully deployed PRODUCTION to ${server}`);
  } catch (e) {
    console.error(`❌ Deployment failed on ${server}:`);
    console.error(e.stdout || e.stderr || e.message);
  }
}

console.log("\n===============================================================");
console.log(`  FULL PRODUCTION VPS DEPLOYMENT COMPLETED!`);
console.log("===============================================================");
