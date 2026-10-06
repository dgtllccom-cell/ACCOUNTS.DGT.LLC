const { execSync } = require('child_process');
try {
  const output = execSync('git status && git log -2 && git remote -v', { encoding: 'utf-8' });
  console.log(output);
} catch (e) {
  console.error(e.message);
}
