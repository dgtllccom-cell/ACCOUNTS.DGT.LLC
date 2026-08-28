import { execSync } from 'child_process';
import fs from 'fs';

const vpsScript = `
import { chromium } from "playwright";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log("Navigating to Purchase Booking Register...");
  await page.goto("http://127.0.0.1:3000/dashboard/purchase/new-purchase-booking-order", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "/var/www/dgt-nextjs/purchase_booking_with_master_products.png", fullPage: false });
  console.log("Saved purchase_booking_with_master_products.png");

  console.log("Navigating to Goods Master Management...");
  try {
    await page.goto("http://127.0.0.1:3000/dashboard/settings/management/goods", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/var/www/dgt-nextjs/goods_master_management.png", fullPage: false });
    console.log("Saved goods_master_management.png");
  } catch (e) {
    console.log("Goods master page load error:", e.message);
  }

  await browser.close();
}
capture();
`;

fs.writeFileSync('scratch/run-capture-goods.mjs', vpsScript);
try {
  execSync('scp -o StrictHostKeyChecking=no scratch/run-capture-goods.mjs root@72.60.209.121:/var/www/dgt-nextjs/run-capture-goods.mjs');
  execSync('ssh -o StrictHostKeyChecking=no root@72.60.209.121 "cd /var/www/dgt-nextjs && node run-capture-goods.mjs"', {
    encoding: 'utf8'
  });
  execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/purchase_booking_with_master_products.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\purchase_booking_with_master_products.png"');
  try {
    execSync('scp -o StrictHostKeyChecking=no root@72.60.209.121:/var/www/dgt-nextjs/goods_master_management.png "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\223c9ebf-c88d-464a-82c5-1feed9c8dae0\\goods_master_management.png"');
  } catch (_) {}
  console.log("Screenshots captured and downloaded successfully!");
} catch (e) {
  console.error("Capture error:", e.message);
}
