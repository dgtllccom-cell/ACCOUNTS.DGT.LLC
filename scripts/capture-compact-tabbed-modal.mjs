import { chromium } from "playwright";
import fs from "node:fs";

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
  page.setDefaultTimeout(40000);

  const BASE_URL = "http://72.60.209.121";

  console.log("1. Authenticating on VPS...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click({ noWaitAfter: true });

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  console.log("   ✓ Successfully logged in!");
  await page.waitForTimeout(2000);

  console.log("\n2. Navigating to Advance Payment Journal...");
  await page.goto(`${BASE_URL}/dashboard/journal/purchase-order-payment/advance`, { waitUntil: "domcontentloaded" });
  await page.waitForResponse(
    (res) => res.url().includes("/api/erp/purchases/orders") && res.status() === 200,
    { timeout: 35000 }
  ).catch(() => {});
  await page.locator('text="Loading"').first().waitFor({ state: "hidden", timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Click row to expand inline audit drawer
  console.log("3. Expanding row in Advance journal...");
  const advanceRow = page.locator('tbody tr:not(:has-text("Loading")):not(:has-text("No records"))').first();
  await advanceRow.click();
  await page.waitForTimeout(1500);

  // Click "POST PAYMENT ENTRY" button inside the expanded row to open the Compact Modal
  console.log("4. Clicking 'POST PAYMENT ENTRY' to open Compact Modal...");
  const postEntryBtn = page.locator('button:has-text("POST PAYMENT ENTRY")').first();
  await postEntryBtn.waitFor({ state: "visible", timeout: 10000 });
  await postEntryBtn.click();
  await page.waitForTimeout(2000);

  // 1. Overview Tab
  console.log("5. Capturing Overview & Accounts Tab...");
  await page.screenshot({ path: `${OUT_DIR}/tab1_overview_accounts.png` });
  console.log("   ✓ Saved tab1_overview_accounts.png");

  // 2. Goods Tab
  console.log("6. Switching to Goods Manifest Tab...");
  const goodsTab = page.locator('button:has-text("Goods Manifest")').first();
  await goodsTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/tab2_goods_manifest.png` });
  console.log("   ✓ Saved tab2_goods_manifest.png");

  // 3. Payments Tab
  console.log("7. Switching to Payments & Ledger Tab...");
  const paymentsTab = page.locator('button:has-text("Payments & Ledger")').first();
  await paymentsTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/tab3_payments_ledger.png` });
  console.log("   ✓ Saved tab3_payments_ledger.png");

  // 4. Transport Tab
  console.log("8. Switching to Transport & Batches Tab...");
  const transportTab = page.locator('button:has-text("Transport & Batches")').first();
  await transportTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/tab4_transport_batches.png` });
  console.log("   ✓ Saved tab4_transport_batches.png");

  await browser.close();
  console.log("\nAll 4 tab verification screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
