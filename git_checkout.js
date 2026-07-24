const { execSync } = require('child_process');
try {
  execSync('git checkout features/roznamcha/components/super-admin-roznamcha-report-view.tsx', { 
    cwd: 'c:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC',
    stdio: 'inherit'
  });
  console.log('Success');
} catch (e) {
  console.error(e.message);
}
