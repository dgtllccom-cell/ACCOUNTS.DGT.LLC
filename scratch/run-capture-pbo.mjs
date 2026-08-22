
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
