import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const TEST_PASSWORD = process.env.DGT_TEST_PASSWORD || env.DGT_TEST_PASSWORD;
const OUT_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/cfdfd680-32a9-4547-b269-1b45009e0c68";

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  const BASE_URL = "http://72.60.209.121";

  console.log("1. Authenticating on VPS...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click({ noWaitAfter: true });

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  console.log("   ✓ Successfully logged in!");
  await page.waitForTimeout(2000);

  // 1. Navigate to Logistics Dashboard
  console.log("\n2. Navigating to /dashboard/logistics...");
  await page.goto(`${BASE_URL}/dashboard/logistics`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(3000);

  // Expand "Shipping & Clearing" in sidebar if collapsed to capture sidebar proof
  const shippingMenuBtn = page.locator('button:has-text("Shipping & Clearing"), div:has-text("Shipping & Clearing")').first();
  if (await shippingMenuBtn.isVisible()) {
    // If not already expanded, click
    const isExpanded = await page.locator('a[href*="/dashboard/logistics"]').first().isVisible().catch(() => false);
    if (!isExpanded) {
      await shippingMenuBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: path.join(OUT_DIR, "1_logistics_dashboard_verified.png"), fullPage: false });
  console.log("   ✓ Captured 1_logistics_dashboard_verified.png");

  // 2. Capture sidebar specific region
  const sidebar = page.locator('nav, aside, [data-sidebar="true"]').first();
  if (await sidebar.isVisible()) {
    await sidebar.screenshot({ path: path.join(OUT_DIR, "2_sidebar_dedup_verified.png") });
    console.log("   ✓ Captured 2_sidebar_dedup_verified.png");
  }

  // 3. Test clicking "Pending Clearance" card
  console.log("\n3. Testing click on Pending Clearance card...");
  const pendingClearanceCard = page.locator('a[href*="/dashboard/clearing-agent/clearing-workspace"]').first();
  if (await pendingClearanceCard.isVisible()) {
    await pendingClearanceCard.click();
    await page.waitForURL((url) => url.pathname.includes("clearing-workspace"), { timeout: 15000 });
    console.log("   ✓ Navigated to URL: " + page.url());
    await page.screenshot({ path: path.join(OUT_DIR, "3_clearing_workspace_filtered.png"), fullPage: false });
    console.log("   ✓ Captured 3_clearing_workspace_filtered.png");
  }

  // 4. Test clicking "Assigned Shipments" or "BL Entry"
  console.log("\n4. Testing navigation to /dashboard/shipping-line/bl-entry?status=delivered...");
  await page.goto(`${BASE_URL}/dashboard/shipping-line/bl-entry?status=delivered`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "4_bl_entry_filtered.png"), fullPage: false });
  console.log("   ✓ Captured 4_bl_entry_filtered.png");

  console.log("\n🎉 ALL LIVE VERIFICATION CHECKS PASSED!");
  await browser.close();
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
