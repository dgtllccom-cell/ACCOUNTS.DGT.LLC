import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

// Directories
const deploymentDir = path.join(projectRoot, 'deployment');
const migrationsDir = path.join(projectRoot, 'database', 'migrations');
const supabaseMigrationsDir = path.join(projectRoot, 'supabase', 'migrations');

if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir, { recursive: true });
if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

// 1. Copy all SQL migration files from supabase/migrations to database/migrations
if (fs.existsSync(supabaseMigrationsDir)) {
  const files = fs.readdirSync(supabaseMigrationsDir);
  for (const file of files) {
    const srcPath = path.join(supabaseMigrationsDir, file);
    const destPath = path.join(migrationsDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log(`[Database] Synced ${files.length} migration files to database/migrations/`);
}

// 2. Move deployment & server scripts to deployment/
const deploymentFilesToMove = [
  'deploy-prod.ps1',
  'deploy-and-verify.js',
  'double-click-to-sync-and-deploy.bat',
  'double-click-to-fix-502.bat',
  'double-click-to-fix-cache-error.bat',
  'double-click-to-fix-git-push.bat',
  'double-click-to-unlock-git.bat',
  'double-click-to-create-backup.bat',
  'double-click-to-extract-review-zip.bat',
  'push-to-github-and-vps.bat',
  'push-to-dht-nextjs.bat',
  'push-to-pr.ps1',
  'run-deploy.bat',
  'run-remote-server-update.bat',
  'run-vps-fix.mjs',
  'server-fix-502.ps1',
  'sync-and-deploy-accounts-dgt.mjs',
  'ssh-test.js',
  'fix-502.mjs',
  'fix-git-lock.ps1',
  'fix-git-secret-push.ps1',
  'fix-history.ps1',
  'fix-secret.ps1',
  'check-git-and-deploy.js',
  'git-status.js',
  'git_checkout.js',
  'git_recovery.ipynb',
  'unlock-and-commit.mjs',
  'commit-and-push.bat',
  'commit-changes.ps1',
  'backup_db.bat'
];

let movedCount = 0;
for (const file of deploymentFilesToMove) {
  const srcPath = path.join(projectRoot, file);
  const destPath = path.join(deploymentDir, file);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, destPath);
    movedCount++;
  }
}
console.log(`[Deployment] Moved ${movedCount} deployment scripts to deployment/`);

// 3. Move loose root test/inspect/scratch files to scripts/
const scriptsFilesToMove = [
  'apply-fixed-migs.mjs',
  'apply-mig.mjs',
  'apply-missing-migs.mjs',
  'check-db.mjs',
  'check-enum.mjs',
  'check-locations.js',
  'check-orders.mjs',
  'check-status-enum.mjs',
  'check-superadmins.ts',
  'check_dups.mjs',
  'check_po.js',
  'check_roznamcha.ts',
  'delete_all_data.ts',
  'find-lines.js',
  'find-purchase-tables.mjs',
  'fix-broken-transfers.ts',
  'fix-now.mjs',
  'fix-wizard-final.mjs',
  'fix-wizard-v3.mjs',
  'fix-wizard-v4.mjs',
  'fix-wizard-v5.mjs',
  'fix-wizard.mjs',
  'fix.mjs',
  'fix_advance.ts',
  'inspect-branch-db.mjs',
  'inspect-db-scratch.mjs',
  'inspect-goods-scratch.mjs',
  'inspect-po.mjs',
  'query.js',
  'reload-schema.js',
  'reload-schema.mjs',
  'replace.js',
  'scratch-diagnose.mjs',
  'test-db-ping.mjs',
  'test-insert.ts',
  'test-ledgers.js',
  'test-zod.ts',
  'test-zod2.ts',
  'test-zod3.ts',
  'validate-braces.mjs'
];

let scriptMovedCount = 0;
const scriptsDir = path.join(projectRoot, 'scripts');
for (const file of scriptsFilesToMove) {
  const srcPath = path.join(projectRoot, file);
  const destPath = path.join(scriptsDir, file);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, destPath);
    scriptMovedCount++;
  }
}
console.log(`[Scripts] Moved ${scriptMovedCount} scratch/test scripts to scripts/`);

// 4. Move log text files to .tmp/
const tmpDir = path.join(projectRoot, '.tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const logFiles = [
  'api-diagnostics-output.txt',
  'api-error-log.txt',
  'build-log.txt',
  'cleanup_log.txt',
  'error_log.txt',
  'output.txt',
  'output2.txt',
  'DT',
  'temp_session_debug.json'
];

for (const file of logFiles) {
  const srcPath = path.join(projectRoot, file);
  const destPath = path.join(tmpDir, file);
  if (fs.existsSync(srcPath)) {
    fs.renameSync(srcPath, destPath);
  }
}

console.log(`[Cleanup] Project reorganization script finished successfully.`);
