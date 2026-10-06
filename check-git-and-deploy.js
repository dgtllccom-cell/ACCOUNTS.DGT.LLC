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
