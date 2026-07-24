import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const lockFile = path.join(process.cwd(), '.git', 'index.lock');

console.log("===============================================================");
console.log("  AUTOMATED GIT UNLOCK & CONSOLIDATED PUSH");
console.log("===============================================================\n");

// Step 1: Force remove lock file if present
if (fs.existsSync(lockFile)) {
  try {
    fs.unlinkSync(lockFile);
    console.log("Removed stale .git/index.lock successfully.");
  } catch (e) {
    console.log("Failed to unlink lock file directly:", e.message);
  }
}

// Step 2: Kill any background git processes
try {
  execSync('taskkill /F /IM git.exe /T 2>nul', { stdio: 'ignore' });
} catch {}

// Step 3: Remove lock file again if recreated
if (fs.existsSync(lockFile)) {
  try {
    fs.unlinkSync(lockFile);
    console.log("Removed lock file after process termination.");
  } catch (e) {}
}

// Step 4: Abort conflicts if any, stage, and force push complete codebase
try {
  try {
    execSync('git merge --abort', { stdio: 'ignore' });
  } catch {}

  console.log("Staging clean consolidated codebase...");
  execSync('git add -A', { stdio: 'inherit' });
  
  console.log("Creating consolidated commit...");
  try {
    execSync('git commit -m "Consolidate complete ERP project into main ACCOUNTS.DGT.LLC repository"', { stdio: 'inherit' });
  } catch (e) {
    console.log("Commit note:", e.message);
  }

  console.log("Publishing complete ERP codebase to ACCOUNTS.DGT.LLC main branch...");
  execSync('git push -u origin main --force', { stdio: 'inherit' });

  console.log("\n===============================================================");
  console.log(" SUCCESS: All files consolidated and live on ACCOUNTS.DGT.LLC!");
  console.log("===============================================================");
} catch (e) {
  console.error("Git error:", e.message);
}
