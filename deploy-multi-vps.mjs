import { execSync } from 'child_process';
import fs from 'fs';

// TARGET BRANCH: Set to 'dev' for ongoing development and testing.
// Switch to 'main' ONLY after final review and approval by user.
const BRANCH = "dev";

// List of target VPS servers (add second IP in SECOND_VPS.txt or directly below)
const SERVERS = [
  "root@72.60.209.121",
];

// Read optional second server IP from file or environment if present
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
console.log("  MULTI-VPS AUTOMATED DEPLOYMENT & GIT SYNC");
console.log(`  Target Branch: [${BRANCH}] (Development Branch)`);
console.log("  Target Servers:", SERVERS.join(", "));
console.log("===============================================================\n");

// Step 1: Git add, commit, and push to dev branch
try {
  console.log(`[1/2] Staging and pushing latest local changes to GitHub (${BRANCH} branch)...`);
  
  // Ensure we are on local dev branch or create/switch to it
  try {
    execSync(`git checkout -B ${BRANCH}`, { stdio: 'inherit' });
  } catch (e) {
    console.log(`Working on branch ${BRANCH}`);
  }

  execSync('git add -A', { stdio: 'inherit' });
  try {
    execSync(`git commit -m "feat(dev): update code on ${BRANCH} branch"`, { stdio: 'inherit' });
  } catch (e) {
    console.log("No new changes to commit.");
  }
  execSync(`git push -u origin ${BRANCH}`, { stdio: 'inherit' });
  console.log(`✅ Code pushed to GitHub (origin/${BRANCH}) successfully!\n`);
} catch (err) {
  console.error("Git push warning/error:", err.message);
}

// Step 2: Loop through all VPS servers and deploy from dev branch
const remoteScript = `
set -e

echo "[VPS 1/5] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[VPS 2/5] Fetching latest code from GitHub (${BRANCH} branch)..."
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

echo "=== DEPLOYMENT COMPLETED ON THIS VPS (${BRANCH} branch) ==="
`;

for (const server of SERVERS) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`🚀 Deploying to Server: ${server} (Branch: ${BRANCH})`);
  console.log(`---------------------------------------------------------------`);
  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no ${server} "bash -s"`, {
      input: remoteScript,
      encoding: 'utf8',
      timeout: 600000
    });
    console.log(out);
    console.log(`✅ Successfully deployed branch '${BRANCH}' to ${server}`);
  } catch (e) {
    console.error(`❌ Deployment failed on ${server}:`);
    console.error(e.stdout || e.stderr || e.message);
  }
}

console.log("\n===============================================================");
console.log(`  ALL VPS DEPLOYMENTS COMPLETED! (Branch: ${BRANCH})`);
console.log("===============================================================");
