import { execSync } from 'child_process';
try {
  execSync('git checkout features/roznamcha/components/super-admin-roznamcha-report-view.tsx');
  console.log('Successfully restored features/roznamcha/components/super-admin-roznamcha-report-view.tsx');
} catch (e) {
  console.error('Error restoring:', e.message);
}
