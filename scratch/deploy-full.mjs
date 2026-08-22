import { execSync } from 'child_process';

try {
  console.log("Syncing route.ts and components to VPS...");
  execSync('scp -o StrictHostKeyChecking=no app/api/erp/purchases/booking-journal-report/route.ts root@72.60.209.121:/var/www/dgt-nextjs/app/api/erp/purchases/booking-journal-report/route.ts');
  execSync('scp -o StrictHostKeyChecking=no features/purchases/components/purchase-booking-journal-report-view.tsx root@72.60.209.121:/var/www/dgt-nextjs/features/purchases/components/purchase-booking-journal-report-view.tsx');
  
  console.log("Building Next.js on VPS...");
  execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && npm run build && pm2 restart dgt-nextjs || pm2 restart all"', {
    encoding: 'utf8',
    timeout: 300000
  });
  console.log("Build and restart complete!");
} catch (e) {
  console.error("Error:", e.message);
}
