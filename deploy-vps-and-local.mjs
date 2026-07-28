import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  1-CLICK GIT SYNC & FULL VPS PRODUCTION DEPLOYMENT: 72.60.209.121");
console.log("===============================================================\n");

// Step 1: Git commit & push
try {
  console.log("[1/3] Staging and committing all local code changes...");
  execSync('git add -A', { stdio: 'inherit' });
  try {
    execSync('git commit -m "feat(deploy): Employee Management System, Branch Hierarchy & User Management Updates"', { stdio: 'inherit' });
  } catch (e) {
    console.log("No new changes to commit or commit already up to date.");
  }

  console.log("\n[2/3] Pushing latest code to GitHub (origin main)...");
  execSync('git push origin main', { stdio: 'inherit' });
  console.log("Git push completed successfully!");
} catch (err) {
  console.error("Git sync warning/error:", err.message);
}

// Step 2: SSH Remote VPS deployment script
console.log("\n[3/3] Executing remote VPS deployment & build on 72.60.209.121...");

const remoteScript = `
set -e

echo "[VPS 1/6] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[VPS 2/6] Safely Handling Logs & Resetting to origin/main (ACCOUNTS.DGT.LLC)..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin main

# Safely remove untracked log files that block Git while protecting .env.local, uploads, and backups
rm -f api-error-log.txt *.log *-log.txt 2>/dev/null || true
git rm --cached api-error-log.txt 2>/dev/null || true
git clean -fd -e .env.local -e .env*.local -e uploads/ -e backups/ -e env_backups/ 2>/dev/null || true

# Force checkout and reset to latest origin/main
git checkout -f -B main origin/main
git reset --hard origin/main

echo "[VPS 3/6] Installing Dependencies & Compiling Next.js..."
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[VPS 4/6] Restarting PM2 process (dgt-nextjs)..."
pm2 delete dgt-nextjs 2>/dev/null || true
pm2 start ecosystem.config.cjs || pm2 start npm --name "dgt-nextjs" -- start
pm2 save

echo "[VPS 5/6] Reloading Nginx Proxy..."
sudo nginx -t || nginx -t
sudo systemctl reload nginx || systemctl reload nginx || service nginx reload

echo "[VPS 6/6] Verifying PM2 Status & Recent Logs..."
pm2 status
pm2 logs dgt-nextjs --lines 15 --nostream || true

echo "\n\n=== VPS DEPLOYMENT COMPLETED SUCCESSFULLY ==="
`;

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s"`, {
    input: remoteScript,
    encoding: 'utf8',
    timeout: 600000
  });
  console.log(out);
  console.log("\nFULL VPS DEPLOYMENT COMPLETED SUCCESSFULLY!");
} catch (e) {
  console.error("Deployment output/error:");
  console.error(e.stdout || e.stderr || e.message);
  process.exit(1);
}
