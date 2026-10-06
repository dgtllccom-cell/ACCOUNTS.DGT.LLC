const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

try {
  // We can just use git grep since it's a git repo!
  const output = execSync('git grep -n -i "loadingPort" -- features/', { encoding: 'utf-8', cwd: 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC' });
  fs.writeFileSync('c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\public\\grep_results.txt', output);
} catch (e) {
  fs.writeFileSync('c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC\\public\\grep_results.txt', e.message + "\n" + (e.stdout || ""));
}
