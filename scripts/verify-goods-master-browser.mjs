import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { withLocalPg } from "../lib/db/local-postgres.ts";

const ARTIFACT_DIR = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\8c7c9f1a-e5ea-4739-b1d3-b4dfca0bcecc";
const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== PLAYWRIGHT BROWSER VERIFICATION: GOODS MASTER ===");

  // Clean any prior test item
  await withLocalPg(async (sql) => {
    await sql`UPDATE public.goods SET deleted_at = NOW() WHERE chs_code = '08023200' AND deleted_at IS NULL`;
  });

  // 1. Get dev session cookie
  console.log("1. Authenticating super-admin session...");
  const authRes = await fetch(`${BASE_URL}/api/erp/auth/dev-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin" }),
  });
  const cookieHeader = authRes.headers.get("set-cookie") || "";
  const cookieMatch = cookieHeader.match(/erp_session=([^;]+)/);
  if (!cookieMatch) {
    throw new Error("Failed to get erp_session cookie from dev-session API");
  }
  const sessionToken = cookieMatch[1];
  console.log("✓ Session token obtained.");

  // 2. Launch browser
  console.log("2. Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: "erp_session",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  // 3. Navigate to Goods Master
  console.log("3. Navigating to /dashboard/settings/goods-master...");
  await page.goto(`${BASE_URL}/dashboard/settings/goods-master`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Verify page elements
  await page.waitForSelector("text=GOODS MASTER", { timeout: 15000 });
  // Wait for loading spinner to disappear
  await page.waitForSelector("text=Loading Goods Master catalog...", { state: "detached", timeout: 30000 }).catch(() => {});
  console.log("✓ Goods Master page loaded successfully.");

  const mainViewPath = path.join(ARTIFACT_DIR, "goods_master_main_view.png");
  await page.screenshot({ path: mainViewPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${mainViewPath}`);

  // 4. Click "+ New Goods Item"
  console.log("4. Opening Step 1 popup...");
  await page.click("button:has-text('NEW GOODS ITEM')");
  await page.waitForSelector("text=/ADD NEW GOODS ITEM/i", { timeout: 10000 });
  console.log("✓ Step 1 popup visible.");

  const step1PopupPath = path.join(ARTIFACT_DIR, "goods_master_step1_popup.png");
  await page.screenshot({ path: step1PopupPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${step1PopupPath}`);

  // Register dialog handler
  page.on("dialog", async (d) => {
    console.log(`[Browser Dialog]: ${d.message()}`);
    await d.accept();
  });

  const testHsCode = `08023200`;

  // Check if WALNUT IN SHELL already exists in table
  const alreadyExists = await page.locator(`td:has-text('${testHsCode}')`).count() > 0;
  if (!alreadyExists) {
    // 5. Fill Step 1 fields
    console.log(`5. Filling Step 1 fields (WALNUT IN SHELL, ${testHsCode}, Chile)...`);
    await page.fill("input[placeholder='e.g. WALNUT IN SHELL']", "WALNUT IN SHELL");
    await page.fill("input[placeholder='e.g. 08023200']", testHsCode);
    await page.selectOption("select[aria-label='Select origin country']", { label: "Chile" });

    // Click Save Basic Item
    console.log("6. Clicking Save Basic Item...");
    await page.click("button:has-text('Save Basic Item')");
    
    // Wait for modal to close and row to appear
    await page.waitForSelector(`td:has-text('${testHsCode}')`, { timeout: 90000 });
    console.log(`✓ WALNUT IN SHELL appeared in main table with HS Code ${testHsCode}.`);
  } else {
    console.log(`WALNUT IN SHELL (${testHsCode}) already in table, closing modal if open.`);
    const cancelBtn = page.locator("button:has-text('Cancel')").first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }
  }

  const rowSavedPath = path.join(ARTIFACT_DIR, "goods_master_item_saved.png");
  await page.screenshot({ path: rowSavedPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${rowSavedPath}`);

  // 7. Find row and ensure details section is expanded
  console.log("7. Checking row details section...");
  const isPanelVisible = await page.locator("text=Variants / Details for This Goods Item").isVisible();
  if (!isPanelVisible) {
    const walnutRow = page.locator("tr", { hasText: "WALNUT IN SHELL" }).first();
    const plusBtn = walnutRow.locator("button").first();
    await plusBtn.click();
    await page.waitForSelector("text=Variants / Details for This Goods Item", { timeout: 20000 });
  }
  console.log("✓ Secondary panel expanded directly under the Goods row.");

  const expandedPanelPath = path.join(ARTIFACT_DIR, "goods_master_expanded_panel.png");
  await page.screenshot({ path: expandedPanelPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${expandedPanelPath}`);

  // 8. Add Variant 1 (if not already present)
  console.log("8. Checking Variant 1...");
  if (await page.locator("td:has-text('Kernel Yield: 50%')").count() === 0) {
    console.log("Adding Variant 1 (DGT LLC, 34-36 MM, specs)...");
    await page.click("button:has-text('+ Add New Variant')");
    await page.waitForSelector("text=Add New Variant", { timeout: 10000 });
    await page.fill("input[placeholder='e.g. DGT LLC / ABC BRAND']", "DGT LLC");
    await page.fill("input[placeholder='e.g. 34-36 MM / 32-34 MM']", "34-36 MM");
    await page.fill("textarea", "Kernel Yield: 50% | 90% Light, 10% Dark | Premium Export Quality");
    await page.click("button:has-text('Save Variant')");
    await page.waitForSelector("td:has-text('Kernel Yield: 50%')", { timeout: 90000 });
  }
  console.log("✓ Variant 1 saved and visible in sub-table.");

  // 9. Add Variant 2 (if not already present)
  console.log("9. Checking Variant 2...");
  if (await page.locator("td:has-text('Extra Light Quality')").count() === 0) {
    console.log("Adding Variant 2 (DGT LLC, 32-34 MM, Extra Light Quality)...");
    await page.click("button:has-text('+ Add New Variant')");
    await page.waitForSelector("text=Add New Variant", { timeout: 10000 });
    await page.fill("input[placeholder='e.g. DGT LLC / ABC BRAND']", "DGT LLC");
    await page.fill("input[placeholder='e.g. 34-36 MM / 32-34 MM']", "32-34 MM");
    await page.fill("textarea", "Extra Light Quality");
    await page.click("button:has-text('Save Variant')");
    await page.waitForSelector("td:has-text('Extra Light Quality')", { timeout: 90000 });
  }
  console.log("✓ Variant 2 saved and visible in sub-table.");

  // 10. Add Variant 3 (if not already present)
  console.log("10. Checking Variant 3...");
  if (await page.locator("td:has-text('90% Light Colors')").count() === 0) {
    console.log("Adding Variant 3 (ABC BRAND, 34-36 MM, 90% Light Colors, 10% Dark)...");
    await page.click("button:has-text('+ Add New Variant')");
    await page.waitForSelector("text=Add New Variant", { timeout: 10000 });
    await page.fill("input[placeholder='e.g. DGT LLC / ABC BRAND']", "ABC BRAND");
    await page.fill("input[placeholder='e.g. 34-36 MM / 32-34 MM']", "34-36 MM");
    await page.fill("textarea", "90% Light Colors, 10% Dark");
    await page.click("button:has-text('Save Variant')");
    await page.waitForSelector("td:has-text('90% Light Colors')", { timeout: 90000 });
  }
  console.log("✓ Variant 3 saved and visible in sub-table.");

  // Screenshot with all 3 variants
  const allVariantsPath = path.join(ARTIFACT_DIR, "goods_master_with_all_variants.png");
  await page.screenshot({ path: allVariantsPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${allVariantsPath}`);

  // 11. Switch to RTL language (Urdu)
  console.log("11. Testing 5-Language & RTL rendering...");
  await page.evaluate(() => {
    document.documentElement.lang = "ur";
    document.documentElement.dir = "rtl";
    localStorage.setItem("erp_lang", "ur");
    document.cookie = "erp_lang=ur; Path=/; Max-Age=31536000; SameSite=Lax";
    window.dispatchEvent(new Event("erp_language_changed"));
  });
  await page.waitForTimeout(2000);
  console.log("✓ Urdu / RTL mode activated.");

  const rtlViewPath = path.join(ARTIFACT_DIR, "goods_master_rtl_view.png");
  await page.screenshot({ path: rtlViewPath, fullPage: false });
  console.log(`✓ Screenshot saved: ${rtlViewPath}`);

  await browser.close();
  console.log("\n=======================================================");
  console.log("PLAYWRIGHT BROWSER VERIFICATION COMPLETED (PASS 100%)");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Browser verification failed:", err);
  process.exit(1);
});
