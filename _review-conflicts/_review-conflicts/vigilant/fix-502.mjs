import { execSync } from 'child_process';
import fs from 'fs';

console.log("===============================================================");
console.log("  EXECUTING DIRECT VPS RECOVERY (72.60.209.121)");
console.log("===============================================================\n");

const SERVER = "root@72.60.209.121";

try {
  console.log("[1/4] Uploading fixed files via SCP...");
  execSync(`scp -o StrictHostKeyChecking=no features/journal/components/purchase-order-payment-journal.tsx ${SERVER}:/var/www/dgt-nextjs/features/journal/components/purchase-order-payment-journal.tsx`, { stdio: 'inherit' });
  execSync(`scp -o StrictHostKeyChecking=no features/purchases/components/purchase-booking-journal-report-view.tsx ${SERVER}:/var/www/dgt-nextjs/features/purchases/components/purchase-booking-journal-report-view.tsx`, { stdio: 'inherit' });
  execSync(`scp -o StrictHostKeyChecking=no app/api/erp/purchases/orders/[id]/route.ts ${SERVER}:/var/www/dgt-nextjs/app/api/erp/purchases/orders/[id]/route.ts`, { stdio: 'inherit' });
  execSync(`scp -o StrictHostKeyChecking=no ecosystem.config.cjs ${SERVER}:/var/www/dgt-nextjs/ecosystem.config.cjs`, { stdio: 'inherit' });
  console.log("Files uploaded successfully.");
} catch (e) {
  console.log("SCP Warning:", e.message);
}

const remoteScript = `
set -e
echo '[2/4] Installing & Building on Server...'
cd /var/www/dgt-nextjs
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo '[3/4] Restarting PM2 process & Nginx...'
pm2 restart dgt-nextjs --update-env || pm2 start ecosystem.config.cjs
pm2 save
systemctl reload nginx

echo '[4/4] Verifying HTTP response...'
curl -I http://127.0.0.1:3000
echo 'SERVER RECOVERY COMPLETE!'
`;

try {
  console.log("\nExecuting remote build & restart...");
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s"`, { input: remoteScript, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log("\nSUCCESS! Server 72.60.209.121 is back online!");
} catch (e) {
  console.error("\nFAILED:", e.message);
}
