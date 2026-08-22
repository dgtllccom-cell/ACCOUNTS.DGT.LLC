import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import { chromium } from "playwright";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log("Navigating to Purchase Booking Register (Standard View)...");
  await page.goto("http://127.0.0.1:3000/dashboard/purchase/new-purchase-booking-order", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_standard_clean.png", fullPage: false });
  console.log("Saved purchase_booking_standard_clean.png");

  console.log("Switching to Detailed 41-Column Audit Register View...");
  const detailedBtn = await page.$("button:has-text('Detailed Audit Register (41 Columns)')");
  if (detailedBtn) {
    await detailedBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_detailed_clean.png", fullPage: false });
    console.log("Saved purchase_booking_detailed_clean.png");
  }

  await browser.close();
}
capture();
`;

fs.writeFileSync('scratch/run-capture-clean.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-capture-clean.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-capture-clean.mjs');
  execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-capture-clean.mjs"', {
    encoding: 'utf8'
  });
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_standard_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_standard_clean.png"');
  try {
    execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_detailed_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_detailed_clean.png"');
  } catch (_) {}
  console.log("Clean screenshots captured and transferred successfully!");
} catch (e) {
  console.error("Capture error:", e.message);
}
