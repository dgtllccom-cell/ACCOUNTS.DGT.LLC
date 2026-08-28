import { execSync } from 'child_process';

const cmd = `
echo "=== NGINX CONFIG ==="
cat /etc/nginx/sites-enabled/* 2>/dev/null || cat /etc/nginx/conf.d/* 2>/dev/null

echo "=== PM2 STATUS ==="
pm2 status

echo "=== RECENT PM2 LOGS ==="
pm2 logs dgt-nextjs --lines 40 --nostream
`;

try {
  const res = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "bash -s"`, {
    input: cmd,
    encoding: 'utf8'
  });
  console.log(res);
} catch (e) {
  console.error("Error:", e.message);
}
