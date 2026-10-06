import { execSync } from 'child_process';

try {
  console.log('Ensuring Git remote origin is set to ACCOUNTS.DGT.LLC...');
  execSync('git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git 2>nul || git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git', { stdio: 'inherit' });

  console.log('Staging all files...');
  execSync('git add .', { stdio: 'inherit' });

  console.log('Committing changes...');
  execSync('git commit -m "feat(structure): establish permanent project structure, deployment, database, env backups, and docs"', { stdio: 'inherit' });

  console.log('Pushing to GitHub...');
  execSync('git push origin main', { stdio: 'inherit' });

  console.log('Git commit and push completed successfully!');
} catch (err) {
  console.error('Git operation failed:', err.message);
}
