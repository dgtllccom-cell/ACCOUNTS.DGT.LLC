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

  const MODES = [
    { name: "Advance Payment", path: "/dashboard/journal/purchase-order-payment/advance", file: "1_advance_compact_drawer.png" },
    { name: "Remaining Payment", path: "/dashboard/journal/purchase-order-payment/remaining", file: "2_remaining_compact_drawer.png" },
    { name: "Credit Payment (Charges)", path: "/dashboard/journal/purchase-order-payment/charges", file: "3_credit_compact_drawer.png" },
    { name: "Final Reconciliation", path: "/dashboard/journal/purchase-order-payment/final", file: "4_final_compact_drawer.png" }
  ];

  for (const m of MODES) {
    console.log(`\nNavigating to ${m.name} (${m.path})...`);
    await page.goto(`${BASE_URL}${m.path}`, { waitUntil: "domcontentloaded" });
    console.log("   Waiting for /api/erp/purchases/orders to resolve...");
    await page.waitForResponse(
      (res) => res.url().includes("/api/erp/purchases/orders") && res.status() === 200,
      { timeout: 35000 }
    ).catch(() => {});
    await page.locator('text="Loading records"').first().waitFor({ state: "hidden", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);

    // Look for rows
    const dataRows = page.locator('tbody tr:not(:has-text("Loading")):not(:has-text("No records"))');
    const count = await dataRows.count();
    console.log(`   Found ${count} data rows in ${m.name}`);

    if (count > 0) {
      const firstRow = dataRows.first();
      // Click 4th cell (Date or Type) to expand drawer without clicking Bill # button
      const cell = firstRow.locator('td').nth(3);
      if (await cell.isVisible()) {
        console.log(`   Expanding drawer on first row...`);
        await cell.click();
        await page.waitForTimeout(2000);

        const outPath = path.join(OUT_DIR, m.file);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`   ✓ Saved screenshot to: ${outPath}`);

        // If Advance or Final, also capture with FX Flow toggled
        if (m.name.includes("Advance") || m.name.includes("Final")) {
          const fxBtn = page.locator('button:has-text("FX Flow")').first();
          if (await fxBtn.isVisible()) {
            console.log(`   Toggling FX Flow...`);
            await fxBtn.click();
            await page.waitForTimeout(800);
            const fxPath = path.join(OUT_DIR, m.file.replace(".png", "_fx_open.png"));
            await page.screenshot({ path: fxPath, fullPage: false });
            console.log(`   ✓ Saved FX Flow screenshot to: ${fxPath}`);
          }
        }
      }
    } else {
      // Capture empty table state
      const outPath = path.join(OUT_DIR, m.file);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`   ✓ Saved empty state screenshot to: ${outPath}`);
    }
  }

  await browser.close();
  console.log("\nAll proofs captured successfully!");
}

main().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
