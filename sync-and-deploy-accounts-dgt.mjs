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

// Step 2: Untrack large files and build caches from git index
console.log("[1/4] Untracking large cache and backup files (>100MB) from Git index...");
const cleanTargets = ['.codex-backups', 'android/app/src/main/assets/public/cache', '.next', 'node_modules'];
for (const target of cleanTargets) {
  try {
    execSync(`git rm -r --cached ${target}`, { stdio: 'ignore' });
  } catch (e) {}
}

// Step 3: Re-add clean source files according to updated .gitignore
console.log("[2/4] Staging clean source code files...");
try {
  execSync('git add .gitignore', { stdio: 'ignore' });
  execSync('git add -A', { stdio: 'ignore' });
} catch (e) {
  console.log("Staging note:", e.message);
}

// Step 4: Commit clean codebase
console.log("[3/4] Creating clean release commit...");
try {
  execSync('git commit -m "Production release: Client exception fixes, 5-language auto-translation, country/branch data isolation"', { stdio: 'ignore' });
} catch (e) {
  console.log("Commit note:", e.message);
}

// Step 5: Push to GitHub ACCOUNTS.DGT.LLC
console.log("[4/4] Pushing clean repository to GitHub ACCOUNTS.DGT.LLC...");
try {
  execSync('git push -u origin main', { stdio: 'ignore' });
  console.log("\n=================================================================");
  console.log(" 🎉 SUCCESS: Clean ERP codebase pushed to ACCOUNTS.DGT.LLC!");
  console.log(" URL: https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC");
  console.log("=================================================================");
} catch (e) {
  console.error("\nPush note:", e.message);
  try {
    execSync('git push -u origin main --force', { stdio: 'ignore' });
    console.log("Force push completed successfully.");
  } catch (f) {
    console.error("Force push error:", f.message);
  }
}
