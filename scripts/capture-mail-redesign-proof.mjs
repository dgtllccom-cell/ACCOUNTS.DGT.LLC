import { chromium } from "playwright";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\4c12fa9e-0503-4abf-8ef3-eb6de060a7ac";

async function captureScreenshots() {
  console.log("Launching headless browser with authentication...");
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();

  try {
    // 0. Login
    console.log("Authenticating at http://localhost:3000/auth/login ...");
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    const adminBtn = page.locator('button:has-text("ADMIN")').first();
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await page.waitForTimeout(500);
    }

    const loginBtn = page.locator('button:has-text("SECURE ERP LOGIN")').first();
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      await page.waitForURL("**/dashboard**", { timeout: 25000 });
      console.log("✓ Successfully authenticated to dashboard!");
    }

    // 1. Mail Overview
    console.log("Capturing 1: Mail Overview & Dashboard...");
    await page.goto("http://localhost:3000/dashboard/mail-management", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const shot1 = path.join(ARTIFACT_DIR, "1_mail_overview.png");
    await page.screenshot({ path: shot1, fullPage: false });
    console.log("Saved:", shot1);

    // 2. Mailbox Management
    console.log("Capturing 2: Mailbox Management (Users & Quotas)...");
    await page.goto("http://localhost:3000/dashboard/mail-management/users", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const shot2 = path.join(ARTIFACT_DIR, "2_mailbox_management.png");
    await page.screenshot({ path: shot2, fullPage: false });
    console.log("Saved:", shot2);

    // 3. Edit Mailbox / Red Password Section
    console.log("Capturing 3: Edit Mailbox / Red Password Section...");
    await page.goto("http://localhost:3000/dashboard/dgt-mail-management", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const addBtn = page.getByRole("button", { name: /Add Mailbox/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
    const shot3 = path.join(ARTIFACT_DIR, "3_edit_mailbox_password.png");
    await page.screenshot({ path: shot3, fullPage: false });
    console.log("Saved:", shot3);

    // 4. Server Health
    console.log("Capturing 4: Server Health & Port Status...");
    await page.goto("http://localhost:3000/dashboard/mail-management/monitoring", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const shot4 = path.join(ARTIFACT_DIR, "4_server_health.png");
    await page.screenshot({ path: shot4, fullPage: false });
    console.log("Saved:", shot4);

    // 5. DNS & Deliverability
    console.log("Capturing 5: DNS & Deliverability...");
    await page.evaluate(() => window.scrollBy(0, 480));
    await page.waitForTimeout(1000);
    const shot5 = path.join(ARTIFACT_DIR, "5_dns_deliverability.png");
    await page.screenshot({ path: shot5, fullPage: false });
    console.log("Saved:", shot5);

    // 6. Mobile View
    console.log("Capturing 6: Mobile View (390x844)...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000/dashboard/mail-management/monitoring", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const shot6 = path.join(ARTIFACT_DIR, "6_mobile_view.png");
    await page.screenshot({ path: shot6, fullPage: false });
    console.log("Saved:", shot6);

    console.log("\n✓ All 6 authenticated screenshots successfully captured!");
  } catch (err) {
    console.error("Error during authenticated capture:", err);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
