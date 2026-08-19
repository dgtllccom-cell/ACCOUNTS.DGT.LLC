import { spawnSync } from 'child_process';

const cmd = `
ls -la /var/www/dgt-nextjs/.next/server/app/dashboard/journal/sales-order-payment/
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("LS RESULT:\n", res.stdout);
