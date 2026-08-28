import { spawnSync } from 'child_process';

const cmd = `
cd /var/www/dgt-nextjs
pm2 restart dgt-nextjs
sleep 2
pm2 status
tail -n 20 /root/.pm2/logs/dgt-nextjs-error-0.log
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("RESTART OUTPUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
