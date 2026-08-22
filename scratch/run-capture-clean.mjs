
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
