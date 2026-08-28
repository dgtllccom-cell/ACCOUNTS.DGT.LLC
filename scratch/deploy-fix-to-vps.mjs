import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const filesToSync = [
  'next.config.ts',
  'lib/supabase/admin.ts',
  'components/layout/digital-dock-premium-sidebar.tsx',
  'app/dashboard/settings/bank/new/page.tsx',
  'app/dashboard/settings/contact-type/new/page.tsx'
];

for (const file of filesToSync) {
  const content = fs.readFileSync(file, 'utf8');
  const remotePath = `/var/www/dgt-nextjs/${file.replace(/\\/g, '/')}`;
  const remoteDir = path.posix.dirname(remotePath);

  console.log(`Syncing ${file} -> ${remotePath}...`);
  // Ensure remote directory exists
  spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', `mkdir -p "${remoteDir}"`]);

  // Write content via ssh
  const proc = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', `cat > "${remotePath}"`], {
    input: content,
    encoding: 'utf8'
  });
  if (proc.status !== 0) {
    console.error(`Failed to sync ${file}:`, proc.stderr);
  } else {
    console.log(`Synced ${file} successfully.`);
  }
}

console.log("\nTriggering Next.js production build on VPS...");
const buildProc = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'cd /var/www/dgt-nextjs && npm run build && pm2 reload dgt-nextjs'], {
  encoding: 'utf8',
  stdio: 'inherit'
});

console.log("\nBuild & PM2 reload complete!");
