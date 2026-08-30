import { chromium } from "playwright";
import path from "path";

const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/ead245f2-295c-41bf-b522-d28b964d1a23";
const BASE_URL = "http://72.60.209.121";

async function captureSteps() {
  console.log("Capturing live VPS Purchase Booking screenshots for all steps...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });
  const page = await context.newPage();
  await page.route('**/*', route => route.continue());

  console.log("1. Logging in...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.fill('input#identifier, input[name="identifier"]', 'superadmin@damaan.com');
  await page.fill('input#password, input[name="password"]', 'Admin@123');
  await page.waitForTimeout(500);
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL("**/dashboard/**", { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);
  await page.waitForTimeout(3000);

  console.log("2. Navigating to Purchase Booking...");
  await page.goto(`${BASE_URL}/dashboard/purchase/new-purchase-booking-order`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);

  // Click "Manual Entry" on the entry method modal
  const manualBtn = page.locator('button:has-text("Manual Entry")').first();
  if (await manualBtn.count() > 0) {
    console.log("Clicking Manual Entry...");
    await manualBtn.click();
    await page.waitForTimeout(2000);
  }

  // If on register inside wizard, click "+ New Booking" button
  const newBookingBtn = page.locator('button:has-text("New Booking")').first();
  if (await newBookingBtn.count() > 0) {
    console.log("Clicking + New Booking to switch from register to form...");
    await newBookingBtn.click();
    await page.waitForTimeout(2000);
  }

  // Handle Super Admin Scope Modal if shown
  const scopeSelects = page.locator('.fixed.inset-0 select');
  if (await scopeSelects.count() > 0) {
    console.log("Selecting scope country and branch...");
    await scopeSelects.nth(0).selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(600);
    const branchSelect = page.locator('.fixed.inset-0 select').nth(1);
    if (await branchSelect.count() > 0) {
      await branchSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    const confirmBtn = page.locator('button:has-text("Confirm Scope")').first();
    if (await confirmBtn.count() > 0) {
      console.log("Clicking Confirm Scope button...");
      await confirmBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // 1. Step 1 screenshot
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "step1_booking_proof.png"), fullPage: false });
  console.log("Saved Step 1 screenshot");

  // 2. Click Step 3 Shipping & Payment
  console.log("Clicking Step 3 Shipping & Payment tab...");
  const shippingTab = page.locator('button:has-text("3 Shipping & Payment")').first();
  if (await shippingTab.count() > 0) {
    await shippingTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "step3_shipping_payment_proof.png"), fullPage: false });
    console.log("Saved Step 3 Shipping & Payment screenshot");
  }

  // 3. Click Step 4 Reports
  console.log("Clicking Step 4 Reports tab...");
  const reportsTab = page.locator('button:has-text("4 Reports")').first();
  if (await reportsTab.count() > 0) {
    await reportsTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "step4_reports_proof.png"), fullPage: false });
    console.log("Saved Step 4 Reports screenshot");
  }

  // 4. Click Step 5 Verify
  console.log("Clicking Step 5 Verify tab...");
  const verifyTab = page.locator('button:has-text("5 Verify")').first();
  if (await verifyTab.count() > 0) {
    await verifyTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "step5_verify_proof.png"), fullPage: false });
    console.log("Saved Step 5 Verify screenshot");
  }

  await browser.close();
}

captureSteps().catch(console.error);
