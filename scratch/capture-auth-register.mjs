import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import { chromium } from "playwright";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log("Navigating to Login...");
  await page.goto("http://127.0.0.1:3000/auth/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Click login button
  const loginBtn = await page.$("button:has-text('SECURE ERP LOGIN')");
  if (loginBtn) {
    console.log("Clicking SECURE ERP LOGIN...");
    await loginBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log("Navigating to Purchase Booking Register (Standard View)...");
  await page.goto("http://127.0.0.1:3000/dashboard/purchase/new-purchase-booking-order", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_standard_clean.png", fullPage: false });
  console.log("Saved purchase_booking_standard_clean.png");

  console.log("Switching to Detailed 41-Column Audit Register View...");
  const buttons = await page.$$("button");
  for (const b of buttons) {
    const text = await b.innerText();
    if (text.includes("Detailed Audit Register") || text.includes("41 Columns")) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_detailed_clean.png", fullPage: false });
  console.log("Saved purchase_booking_detailed_clean.png");

  await browser.close();
}
capture();
`;

fs.writeFileSync('scratch/run-capture-auth.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-capture-auth.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-capture-auth.mjs');
  execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-capture-auth.mjs"', {
    encoding: 'utf8'
  });
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_standard_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_standard_clean.png"');
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_detailed_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_detailed_clean.png"');
  console.log("Authenticated screenshots captured and transferred successfully!");
} catch (e) {
  console.error("Error:", e.message);
}
