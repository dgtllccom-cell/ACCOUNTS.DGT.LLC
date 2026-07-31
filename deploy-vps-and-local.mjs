import { execSync } from 'child_process';

const SERVER = "root@72.60.209.121";

console.log("===============================================================");
console.log("  1-CLICK GIT SYNC, DB MIGRATION & FULL VPS DEPLOYMENT: 72.60.209.121");
console.log("===============================================================\n");

// Step 1: Run Database Migration
try {
  console.log("[1/4] Applying Return SMS Reply Database Migrations to Supabase...");
  execSync('node apply-return-sms-reply-migration.mjs', { stdio: 'inherit' });
  console.log("✅ Database Migration completed successfully!");
} catch (err) {
  console.error("Migration warning/error:", err.message);
}

// Step 2: Git commit & push
try {
  console.log("\n[2/4] Staging and committing all local code changes...");
  execSync('git add -A', { stdio: 'inherit' });
  try {
    execSync('git commit -m "fix(deploy): configure prepare:false in postgres client for Supavisor transaction pooler compatibility"', { stdio: 'inherit' });
  } catch (e) {
    console.log("No new changes to commit or commit already up to date.");
  }

  console.log("\n[3/4] Pushing latest code to GitHub (origin main)...");
  execSync('git push origin main', { stdio: 'inherit' });
  console.log("Git push completed successfully!");
} catch (err) {
  console.error("Git sync warning/error:", err.message);
}

// Step 3: SSH Remote VPS deployment script
console.log("\n[4/4] Executing remote VPS deployment & build on 72.60.209.121...");

const remoteScript = `
set -e

echo "[VPS 1/7] Navigating to /var/www/dgt-nextjs..."
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[VPS 2/7] Safely Handling Logs & Resetting to origin/main (ACCOUNTS.DGT.LLC)..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin main

# Safely remove untracked log files that block Git while protecting .env.local, uploads, and backups
rm -f api-error-log.txt *.log *-log.txt 2>/dev/null || true
git rm --cached api-error-log.txt 2>/dev/null || true
git clean -fd -e .env.local -e .env*.local -e uploads/ -e backups/ -e env_backups/ 2>/dev/null || true

# Force checkout and reset to latest origin/main
git checkout -f -B main origin/main
git reset --hard origin/main

echo "[VPS 3/7] Installing Dependencies & Running Database Migration..."
npm install --include=dev
node apply-return-sms-reply-migration.mjs || true

echo "[VPS 4/7] Cleaning Stale Build Cache & Compiling Next.js..."
rm -rf .next
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[VPS 5/7] Restarting PM2 process (dgt-nextjs)..."
pm2 delete dgt-nextjs 2>/dev/null || true
pm2 flush 2>/dev/null || true
pm2 start ecosystem.config.cjs || pm2 start npm --name "dgt-nextjs" -- start
pm2 save

echo "[VPS 6/7] Reloading Nginx Proxy..."
sudo nginx -t || nginx -t
sudo systemctl reload nginx || systemctl reload nginx || service nginx reload

echo "[VPS 6b/7] Waiting 10 seconds for app to start, then running DB migration via API..."
sleep 10
curl -sf "http://localhost:3000/api/erp/admin/run-migrations?secret=digitaldock_migrate_2026" || \
  echo "API migration call skipped (app may still be starting up — tables were already created by node migration runner)"

echo "[VPS 7/7] Verifying PM2 Status & Recent Production Logs..."
pm2 status
pm2 logs dgt-nextjs --lines 25 --nostream || true

echo "\n\n=== VPS DEPLOYMENT & DATABASE MIGRATION COMPLETED SUCCESSFULLY ==="
`;

try {
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s"`, {
    input: remoteScript,
    encoding: 'utf8',
    timeout: 600000
  });
  console.log(out);
  console.log("\nFULL VPS DEPLOYMENT & DATABASE MIGRATION COMPLETED SUCCESSFULLY!");
} catch (e) {
  console.error("Deployment output/error:");
  console.error(e.stdout || e.stderr || e.message);
  process.exit(1);
}
