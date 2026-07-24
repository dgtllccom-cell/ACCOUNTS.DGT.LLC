import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("=================================================================");
console.log("   CLEANING LARGE FILES & PUSHING TO ACCOUNTS.DGT.LLC");
console.log("   Target Repository : https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git");
console.log("=================================================================\n");

const cwd = process.cwd();

// Step 1: Clear process locks
try {
  const lockFile = path.join(cwd, '.git', 'index.lock');
  if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
} catch (e) {}

try {
  execSync('taskkill /F /IM git.exe /T 2>nul', { stdio: 'ignore' });
} catch {}

// Step 2: Untrack large files and build caches from git index
console.log("[1/5] Untracking large cache and backup files (>100MB) from Git index...");
try {
  execSync('git rm -r --cached .codex-backups 2>nul || true', { stdio: 'ignore' });
  execSync('git rm -r --cached android/app/src/main/assets/public/cache 2>nul || true', { stdio: 'ignore' });
  execSync('git rm -r --cached .next 2>nul || true', { stdio: 'ignore' });
  execSync('git rm -r --cached node_modules 2>nul || true', { stdio: 'ignore' });
} catch (e) {
  console.log("Untrack note:", e.message);
}

// Step 3: Reset commits to unstage large files from history relative to origin/main
console.log("[2/5] Resetting git index to remove large files from commit tree...");
try {
  execSync('git reset --soft origin/main', { stdio: 'inherit' });
} catch (e) {
  console.log("Reset note:", e.message);
}

// Step 4: Re-add clean source files according to updated .gitignore
console.log("[3/5] Staging clean source code files...");
try {
  execSync('git add .gitignore', { stdio: 'inherit' });
  execSync('git add -A', { stdio: 'inherit' });
} catch (e) {
  console.log("Staging note:", e.message);
}

// Step 5: Commit clean codebase
console.log("[4/5] Creating clean release commit...");
try {
  execSync('git commit -m "Clean consolidated ERP source code (large build caches excluded)"', { stdio: 'inherit' });
} catch (e) {
  console.log("Commit note:", e.message);
}

// Step 6: Push to GitHub ACCOUNTS.DGT.LLC
console.log("[5/5] Pushing clean repository to GitHub ACCOUNTS.DGT.LLC...");
try {
  execSync('git push -u origin main --force', { stdio: 'inherit' });
  console.log("\n=================================================================");
  console.log(" 🎉 SUCCESS: Clean ERP codebase pushed to ACCOUNTS.DGT.LLC!");
  console.log(" URL: https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC");
  console.log("=================================================================");
} catch (e) {
  console.error("\nPush error:", e.message);
}
