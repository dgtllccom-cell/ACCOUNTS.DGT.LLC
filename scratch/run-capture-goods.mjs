
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
