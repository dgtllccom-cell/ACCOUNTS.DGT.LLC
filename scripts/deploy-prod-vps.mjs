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

// ---------------------------------------------------------------------------
// SAFETY GUARDS (added 2026-08-27)
//   The previous version ran `git add -A` + auto-committed the ENTIRE working
//   tree as "DeployBot" and then `git push -f`. That silently swept unrelated
//   / unfinished files into production commits and could clobber commits made
//   elsewhere. New behaviour:
//     * refuses to run with a dirty working tree (commit intentionally first)
//       -> override for legacy automation with  DEPLOY_ALLOW_DIRTY=1
//     * when overridden, commits ONLY already-staged changes (never `git add -A`)
//     * uses `--force-with-lease` instead of `-f` so it never overwrites
//       commits it has not seen.
// ---------------------------------------------------------------------------
function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }).trim(); }

try {
  if (fs.existsSync('.git/index.lock')) {
    try { fs.unlinkSync('.git/index.lock'); } catch {}
  }

  const dirty = sh('git status --porcelain');
  const allowDirty = process.env.DEPLOY_ALLOW_DIRTY === '1';

  if (dirty && !allowDirty) {
    console.error("\n✗ DEPLOY ABORTED — working tree is not clean.\n");
    console.error("The following files are uncommitted:\n");
    console.error(dirty + "\n");
    console.error("Commit (or stash) your intended changes yourself, then re-run the deploy.");
    console.error("To bypass for CI/automation (NOT recommended): DEPLOY_ALLOW_DIRTY=1 npm run deploy:prod\n");
    process.exit(1);
  }

  if (dirty && allowDirty) {
    // Only commit what has been *explicitly staged* — never `git add -A`.
    const staged = sh('git diff --cached --name-only');
    if (staged) {
      console.log("DEPLOY_ALLOW_DIRTY=1 — committing already-staged files only:\n" + staged + "\n");
      try {
        execSync('git -c user.name="DeployBot" -c user.email="deploy@damaan.local" commit -m "chore(deploy): staged changes bundled by deploy script"', { stdio: 'inherit' });
      } catch { console.log("Commit skipped or already clean"); }
    } else {
      console.log("DEPLOY_ALLOW_DIRTY=1 set but nothing staged — unstaged changes will NOT be deployed.");
    }
  }

  console.log("Syncing with GitHub remote main...");
  try {
    execSync('git fetch origin main', { stdio: 'inherit' });
    try {
      execSync('git rebase origin/main', { stdio: 'inherit' });
    } catch {
      execSync('git rebase --abort', { stdio: 'inherit' });
      execSync('git merge origin/main --no-edit', { stdio: 'inherit' });
    }
  } catch (err) {
    console.log("Remote sync notice:", err.message);
  }

  execSync('git push --force-with-lease origin HEAD:main', { stdio: 'inherit' });
  console.log("✅ GitHub main branch updated successfully from HEAD!\n");
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

echo "[VPS 3.5/5] Running Database Migration & Multilingual Ports Seeder..."
node scripts/populate-ports-multilingual.mjs || true

echo "[VPS 4/5] Building Next.js application..."
rm -rf .next
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[VPS 5/5] Restarting PM2 process and reloading Nginx..."
pm2 delete dgt-nextjs 2>/dev/null || true
pm2 start ecosystem.config.cjs || pm2 start npm --name "dgt-nextjs" -- start
pm2 save
sudo systemctl reload nginx || systemctl reload nginx 2>/dev/null || true

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
