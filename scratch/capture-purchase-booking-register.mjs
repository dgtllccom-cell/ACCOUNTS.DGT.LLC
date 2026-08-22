import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import { chromium } from '@playwright/test';
import fs from 'node:fs';

async function run() {
  console.log("=== CAPTURING LIVE PURCHASE BOOKING REGISTER ===");
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US'
  });

  const page = await context.newPage();
  const baseUrl = 'http://127.0.0.1:3000';

  try {
    console.log("Navigating to Purchase Booking Register...");
    await page.goto(baseUrl + '/dashboard/purchase/new-purchase-booking-order', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/purchase_booking_register_populated.png', fullPage: false });

    // Also take a full page screenshot
    await page.screenshot({ path: '/tmp/purchase_booking_register_full.png', fullPage: true });

    console.log("✅ Screenshots captured successfully on VPS!");
  } catch (e) {
    console.error("Screenshot error:", e);
  } finally {
    await browser.close();
  }
}
run();
`;

fs.writeFileSync('scratch/run-capture-pbo.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-capture-pbo.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-capture-pbo.mjs');
  const res = execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-capture-pbo.mjs"', {
    encoding: 'utf8',
    timeout: 120000
  });
  console.log(res);

  // Copy screenshots locally
  console.log("Copying screenshots locally...");
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/tmp/purchase_booking_register_populated.png C:/Users/dgtll/.gemini/antigravity-ide/brain/223c9ebf-c88d-464a-82c5-1feed9c8dae0/purchase_booking_register_populated.png');
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/tmp/purchase_booking_register_full.png C:/Users/dgtll/.gemini/antigravity-ide/brain/223c9ebf-c88d-464a-82c5-1feed9c8dae0/purchase_booking_register_full.png');
  console.log("✅ Screenshots transferred successfully!");
} catch (e) {
  console.error("Execution error:", e.message);
}
