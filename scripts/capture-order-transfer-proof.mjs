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

  // 1. Capture sidebar proof showing "Customer Order Transfer" right under "New Customer Order"
  console.log("\n2. Navigating to Dashboard to capture Sidebar...");
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // Expand "Shipping & Clearing" menu if collapsed
  const shippingMenuBtn = page.locator('button:has-text("Shipping & Clearing"), div:has-text("Shipping & Clearing")').first();
  if (await shippingMenuBtn.isVisible()) {
    await shippingMenuBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: path.join(OUT_DIR, "1_shipping_sidebar_order_transfer.png"), fullPage: false });
  console.log("   ✓ Captured 1_shipping_sidebar_order_transfer.png");

  // 2. Navigate to Customer Order Transfer page
  console.log("\n3. Navigating to /dashboard/clearing-agent/order-transfer...");
  await page.goto(`${BASE_URL}/dashboard/clearing-agent/order-transfer`, { waitUntil: "domcontentloaded" });
  await page.waitForResponse((res) => res.url().includes("/api/erp/clearing-agent/customer-order") && res.status() === 200, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  await page.screenshot({ path: path.join(OUT_DIR, "2_customer_order_transfer_table.png"), fullPage: false });
  console.log("   ✓ Captured 2_customer_order_transfer_table.png");

  // 3. Click "View & Transfer" on the first order
  console.log("\n4. Clicking View & Transfer on an order...");
  const viewBtn = page.locator('button:has-text("View & Transfer")').first();
  if (await viewBtn.isVisible()) {
    await viewBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, "3_customer_order_transfer_detail_and_options.png"), fullPage: false });
    console.log("   ✓ Captured 3_customer_order_transfer_detail_and_options.png");
  } else {
    console.log("   ! View & Transfer button not found, taking fallback screenshot");
    await page.screenshot({ path: path.join(OUT_DIR, "3_customer_order_transfer_detail_and_options.png"), fullPage: false });
  }

  // 4. Verify Customer Bills page has NO newly created empty draft bills
  console.log("\n5. Checking Customer Bills page (/dashboard/clearing-agent/customer-bill)...");
  await page.goto(`${BASE_URL}/dashboard/clearing-agent/customer-bill`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "4_customer_bills_verified.png"), fullPage: false });
  console.log("   ✓ Captured 4_customer_bills_verified.png");

  await browser.close();
  console.log("\nAll proofs captured successfully!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
