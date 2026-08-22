import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import { chromium } from "playwright";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:3000/auth/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.fill("input[name='identifier']", "superadmin@damaan.com");
  await page.fill("input[name='password']", "Admin@123");
  await page.click("button:has-text('SECURE ERP LOGIN')");
  await page.waitForTimeout(3000);

  await page.goto("http://127.0.0.1:3000/dashboard/purchase/new-purchase-booking-order", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Click Standard Register (13 Columns)
  const stdBtn = await page.$("button:has-text('Standard Register (13 Columns)')");
  if (stdBtn) {
    await stdBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_standard_clean.png", fullPage: false });

  // Click Detailed Audit Register (41 Columns)
  const detBtn = await page.$("button:has-text('Detailed Audit Register (41 Columns)')");
  if (detBtn) {
    await detBtn.click();
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_detailed_clean.png", fullPage: false });

  await browser.close();
}
capture();
`;

fs.writeFileSync('scratch/run-capture-both-toggle.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-capture-both-toggle.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-capture-both-toggle.mjs');
  execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-capture-both-toggle.mjs"', {
    encoding: 'utf8'
  });
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_standard_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_standard_clean.png"');
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_detailed_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_detailed_clean.png"');
  console.log("Both toggle screenshots captured and downloaded successfully!");
} catch (e) {
  console.error("Error:", e.message);
}
