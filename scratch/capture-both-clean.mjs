import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import { chromium } from "playwright";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
  const page = await context.newPage();

  console.log("Navigating to Purchase Booking Register...");
  await page.goto("http://127.0.0.1:3000/dashboard/purchase/new-purchase-booking-order", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Standard screenshot
  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_standard_clean.png", fullPage: false });

  // Click Detailed button
  const buttons = await page.$$("button");
  for (const b of buttons) {
    const text = await b.innerText();
    if (text.includes("Detailed Audit Register") || text.includes("41 Columns")) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_detailed_clean.png", fullPage: false });

  await browser.close();
}
capture();
`;

fs.writeFileSync('scratch/run-capture-fast.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-capture-fast.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-capture-fast.mjs');
  execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-capture-fast.mjs"', {
    encoding: 'utf8'
  });
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_standard_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_standard_clean.png"');
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_detailed_clean.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_detailed_clean.png"');
  console.log("Both screenshots captured and transferred successfully!");
} catch (e) {
  console.error("Error:", e.message);
}
