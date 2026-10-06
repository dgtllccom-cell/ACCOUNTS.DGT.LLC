import { execSync } from 'child_process';

const BRANCH = "dev";

console.log("===============================================================");
console.log(`  PUSH CODE TO GITHUB [${BRANCH.toUpperCase()}] BRANCH ONLY (NO VPS DEPLOY)`);
console.log("===============================================================\n");

try {
  // Ensure we are on dev branch
  try {
    execSync(`git checkout -B ${BRANCH}`, { stdio: 'inherit' });
  } catch (e) {
    console.log(`Switched to branch ${BRANCH}`);
  }

  console.log(`[1/3] Staging all local code changes...`);
  execSync('git add -A', { stdio: 'inherit' });

  console.log(`[2/3] Committing changes...`);
  try {
    execSync(`git commit -m "feat(dev): update development code on ${BRANCH} branch"`, { stdio: 'inherit' });
  } catch (e) {
    console.log("No new changes to commit.");
  }

  console.log(`[3/3] Pushing to GitHub repository (origin/${BRANCH})...`);
  execSync(`git push -u origin ${BRANCH}`, { stdio: 'inherit' });

  console.log("\n===============================================================");
  console.log(`  SUCCESS! Code pushed to GitHub branch '${BRANCH}'. VPS untouched.`);
  console.log("===============================================================");
} catch (err) {
  console.error("Error during Git push:", err.message);
  process.exit(1);
}
