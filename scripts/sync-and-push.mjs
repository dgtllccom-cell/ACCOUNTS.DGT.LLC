import { execSync } from 'child_process';

console.log("=== Git Synchronization ===");
try {
  const statusBefore = execSync('git status --porcelain', { encoding: 'utf8' });
  console.log("Status before add:\n" + (statusBefore || "(Clean working tree)"));

  execSync('git add -A', { stdio: 'inherit' });

  try {
    execSync('git commit -m "Clean consolidated ERP source code and configuration sync"', { stdio: 'inherit' });
  } catch (e) {
    console.log("Nothing to commit or commit already up to date.");
  }

  console.log("Pushing to GitHub main...");
  execSync('git push origin main', { stdio: 'inherit' });
  console.log("Git push completed successfully!");
} catch (err) {
  console.error("Git operation failed:", err.message);
  process.exit(1);
}
