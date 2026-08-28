
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
