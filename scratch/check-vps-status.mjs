import { spawnSync } from 'child_process';

const cmd = `
echo "=== VPS GIT STATUS & LOG ==="
cd /var/www/dgt-nextjs
git status
git log -n 5 --oneline

echo "=== VPS PM2 LOGS (MORE LINES) ==="
pm2 logs dgt-nextjs --lines 100 --nostream 2>/dev/null || true
`;

const res = spawnSync('ssh', ['-o', 'StrictHostKeyChecking=no', 'root@72.60.209.121', 'bash -s'], {
  input: cmd,
  encoding: 'utf8'
});

console.log("STDOUT:\n", res.stdout);
console.log("STDERR:\n", res.stderr);
