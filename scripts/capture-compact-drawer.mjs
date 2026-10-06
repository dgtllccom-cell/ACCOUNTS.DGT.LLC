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

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const BASE_URL = "http://72.60.209.121";
  console.log("Navigating to login...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click({ noWaitAfter: true });

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  console.log("✓ Successfully authenticated to dashboard!");
  await page.waitForTimeout(2000);

  console.log("Navigating to Purchase Order Payment Advance Journal...");
  await page.goto(`${BASE_URL}/dashboard/journal/purchase-order-payment/advance?purchaseOrderNo=AE-001-0002`, { waitUntil: "domcontentloaded" });
  console.log("Waiting for data response...");
  await page.waitForResponse((res) => res.url().includes("/api/erp/purchases/orders") && res.status() === 200, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const debugShot = "C:/Users/dgtll/.gemini/antigravity-ide/brain/cfdfd680-32a9-4547-b269-1b45009e0c68/debug_page.png";
  await page.screenshot({ path: debugShot });
  console.log("Debug screenshot saved to:", debugShot);

  const targetRow = page.locator('tbody tr:has-text("AE-001-0002")').first();
  if (await targetRow.isVisible()) {
    console.log("Found AE-001-0002 row, clicking to ensure drawer is open...");
    const fxBtn = page.locator('button:has-text("FX Flow")').first();
    if (!await fxBtn.isVisible()) {
      await targetRow.click();
      await page.waitForTimeout(2000);
    }
  } else {
    const anyDataRow = page.locator('tbody tr:not(:has-text("Loading")):not(:has-text("No records"))').first();
    if (await anyDataRow.isVisible()) {
      console.log("Clicking first available data row...");
      await anyDataRow.click();
      await page.waitForTimeout(2000);
    }
  }

  const shotPath = "C:/Users/dgtll/.gemini/antigravity-ide/brain/cfdfd680-32a9-4547-b269-1b45009e0c68/compact_drawer_proof.png";
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log("Screenshot successfully saved to:", shotPath);

    const fxBtn = page.locator('button:has-text("FX Flow")').first();
    if (await fxBtn.isVisible()) {
      console.log("Clicking FX Flow toggle...");
      await fxBtn.click();
      await page.waitForTimeout(500);
      const shotPathFx = "C:/Users/dgtll/.gemini/antigravity-ide/brain/cfdfd680-32a9-4547-b269-1b45009e0c68/compact_drawer_fx_open_proof.png";
      await page.screenshot({ path: shotPathFx, fullPage: false });
      console.log("Screenshot with FX flow open saved to:", shotPathFx);
    }

  await browser.close();
  console.log("Proof captured successfully!");
}

main().catch((err) => {
  console.error("Error in capture script:", err);
  process.exit(1);
});
