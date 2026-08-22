import { execSync } from 'child_process';

try {
  execSync('scp -o StrictHostKeyChecking=no scratch/inspect-all-tables.mjs root@72.60.209.121:/var/www/dgt-nextjs/inspect-all-tables.mjs');
  const res = execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node inspect-all-tables.mjs"', {
    encoding: 'utf8'
  });
  console.log(res);
} catch (e) {
  console.error("Error:", e.message);
}
