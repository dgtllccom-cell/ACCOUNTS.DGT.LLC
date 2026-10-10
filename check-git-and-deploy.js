if (!process.env.DGT_ALLOW_LEGACY_DEPLOY) { console.error("DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate (scripts/production/dgt-deploy-gate.sh) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. (Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.)"); process.exit(1); }
const { execSync } = require('child_process');

try {
  console.log("=== Checking Local Git Status ===");
  const status = execSync('git status --short', { encoding: 'utf-8' });
  console.log(status || "Working tree clean.");

  console.log("\n=== Checking Recent Commits ===");
  const log = execSync('git log -n 3 --oneline', { encoding: 'utf-8' });
  console.log(log);

  console.log("\n=== Testing Git Push ===");
  const pushResult = execSync('git push origin main', { encoding: 'utf-8' });
  console.log(pushResult);
} catch (e) {
  console.error("\n*** ERROR EXECUTING GIT COMMAND ***");
  console.error(e.stdout || '');
  console.error(e.stderr || '');
  console.error(e.message);
}
