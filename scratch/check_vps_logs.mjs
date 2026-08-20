import { execSync } from 'child_process';

try {
  console.log("=== PM2 LOGS ===");
  const pm2Logs = execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "pm2 logs dgt-nextjs --lines 50 --nostream"', { encoding: 'utf8' });
  console.log(pm2Logs);
} catch (e) {
  console.error("PM2 Log Error:", e.message);
}

try {
  console.log("=== NGINX ERROR LOGS ===");
  const nginxLogs = execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "tail -n 50 /var/log/nginx/error.log"', { encoding: 'utf8' });
  console.log(nginxLogs);
} catch (e) {
  console.error("Nginx Log Error:", e.message);
}
