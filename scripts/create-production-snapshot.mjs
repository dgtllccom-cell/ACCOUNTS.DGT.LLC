import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const STABLE_TAG = "v1.0.0-stable-production";
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_ROOT = path.join(process.cwd(), "backups", `stable-production-release-${STAMP}`);

console.log("=================================================================");
console.log("   DIGITAL DOCK ERP - PRODUCTION RELEASE STABLE BACKUP ENGINE");
console.log(`   Release Tag : ${STABLE_TAG}`);
console.log(`   Backup Path : ${BACKUP_ROOT}`);
console.log("=================================================================\n");

try {
  // 1. Create Backup Folder Hierarchy
  fs.mkdirSync(path.join(BACKUP_ROOT, "configs"), { recursive: true });
  fs.mkdirSync(path.join(BACKUP_ROOT, "migrations"), { recursive: true });
  fs.mkdirSync(path.join(BACKUP_ROOT, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(BACKUP_ROOT, "db_data"), { recursive: true });

  // 2. Git Commit & Tagging
  let commitHash = "unknown";
  let branchName = "main";
  try {
    commitHash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    branchName = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();

    // Tag the stable commit locally and on remote if available
    try {
      execSync(`git tag -a ${STABLE_TAG} -m "Stable Production Version ${STABLE_TAG}"`, { stdio: "pipe" });
      console.log(`[SUCCESS] Git tag '${STABLE_TAG}' created locally.`);
    } catch {
      console.log(`[INFO] Git tag '${STABLE_TAG}' already exists.`);
    }
  } catch (e) {
    console.warn(`[WARN] Git info warning: ${e.message}`);
  }

  // 3. Backup Configuration Files
  const configFiles = [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "ecosystem.config.cjs",
    ".gitignore",
    "tsconfig.json",
    "tailwind.config.ts"
  ];
  configFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(BACKUP_ROOT, "configs", file));
    }
  });

  // 4. Backup Deployment Scripts
  const deployScripts = [
    "deploy-and-verify.js",
    "deploy-prod.ps1",
    "double-click-to-deploy.bat",
    "double-click-to-fix-502.bat",
    "server-fix-502.ps1",
    "HOSTINGER_DATA"
  ];
  deployScripts.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(BACKUP_ROOT, "scripts", file));
    }
  });

  // 5. Copy Supabase Database Migrations
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir);
    files.forEach(file => {
      fs.copyFileSync(path.join(migrationsDir, file), path.join(BACKUP_ROOT, "migrations", file));
    });
    console.log(`[SUCCESS] Copied ${files.length} database migration files.`);
  }

  // 6. Run Database Data Dump via db-backup-engine
  try {
    console.log("\n[INFO] Triggering Database Table Data Dump...");
    execSync(`node scripts/db-backup-engine.mjs --output "${path.join(BACKUP_ROOT, "db_data")}"`, { stdio: "inherit" });
  } catch (e) {
    console.warn(`[WARN] DB dump notice: ${e.message}`);
  }

  // 7. Write Release Manifest
  const manifest = {
    releaseTag: STABLE_TAG,
    status: "STABLE_PRODUCTION",
    timestamp: new Date().toISOString(),
    commitHash,
    branch: branchName,
    server: "72.60.209.121 (Hostinger VPS)",
    pm2App: "dgt-nextjs",
    port: 3000,
    backupLocation: BACKUP_ROOT,
    restoreInstructions: [
      "1. Git restore: git checkout " + STABLE_TAG,
      "2. Server restore: ssh root@72.60.209.121 'cd /var/www/dgt-nextjs && git reset --hard " + commitHash + " && npm install && npm run build && pm2 restart dgt-nextjs'",
      "3. Environment restore: /var/www/env_backups/.env.bak"
    ]
  };

  fs.writeFileSync(path.join(BACKUP_ROOT, "MANIFEST_RELEASE.json"), JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(path.join(process.cwd(), "STABLE_RELEASE_V1.0.0.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log("\n=================================================================");
  console.log("   🎉 STABLE PRODUCTION BACKUP CREATED SUCCESSFULLY!");
  console.log(`   - Release Tag      : ${STABLE_TAG}`);
  console.log(`   - Commit Hash      : ${commitHash}`);
  console.log(`   - Backup Directory : ${BACKUP_ROOT}`);
  console.log(`   - Manifest File    : STABLE_RELEASE_V1.0.0.json`);
  console.log("=================================================================");

} catch (err) {
  console.error("[CRITICAL ERROR] Failed to create stable backup:", err);
  process.exit(1);
}
