
import { chromium } from "playwright";

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log("Navigating to Login page...");
  await page.goto("http://127.0.0.1:3000/auth/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  console.log("Filling login credentials...");
  await page.fill("input[name='identifier']", "superadmin@damaan.com");
  await page.fill("input[name='password']", "Admin@123");
  await page.click("button:has-text('SECURE ERP LOGIN')");
  
  await page.waitForTimeout(4000);

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
