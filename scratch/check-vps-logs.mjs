import { spawnSync } from 'child_process';

const cmd = `
echo "=== PM2 STATUS ==="
pm2 status

echo "=== PM2 ERROR LOGS ==="
pm2 logs dgt-nextjs --lines 50 --nostream --err 2>/dev/null || tail -n 50 /root/.pm2/logs/dgt-nextjs-error.log 2>/dev/null || true

echo "=== RECENT OUT LOGS ==="
tail -n 30 /root/.pm2/logs/dgt-nextjs-out.log 2>/dev/null || true
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
