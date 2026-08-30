import { chromium } from "playwright";
import path from "path";

const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/ead245f2-295c-41bf-b522-d28b964d1a23";
const BASE_URL = "http://72.60.209.121";

async function capturePurchaseBooking() {
  console.log("Capturing live VPS Purchase Booking screenshot...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 }
  });
  const page = await context.newPage();

  console.log("1. Navigating to login page...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log("2. Filling credentials...");
  await page.fill('#identifier', 'superadmin@dgt.llc');
  await page.fill('#password', 'AdminPassword123!');
  await page.waitForTimeout(500);

  console.log("3. Submitting login...");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/dashboard/**", { timeout: 20000 });
  console.log("4. Login success!");

  console.log("5. Navigating to New Purchase Booking Order...");
  await page.goto(`${BASE_URL}/dashboard/purchase/new-purchase-booking-order?mode=new`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  const screenshotPath = path.join(ARTIFACTS_DIR, "purchase_booking_redesign_proof.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("Saved purchase booking redesign screenshot to:", screenshotPath);

  await browser.close();
}

capturePurchaseBooking().catch(console.error);
