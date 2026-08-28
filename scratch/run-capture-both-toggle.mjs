
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
