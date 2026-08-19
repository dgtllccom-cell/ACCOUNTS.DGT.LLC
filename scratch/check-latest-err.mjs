import { spawnSync } from 'child_process';

const cmd = `
tail -n 60 /root/.pm2/logs/dgt-nextjs-error-0.log
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("PM2 ERROR LOG:\n", res.stdout);
