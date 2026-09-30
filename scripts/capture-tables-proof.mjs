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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  const BASE_URL = "http://72.60.209.121";

  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click({ noWaitAfter: true });

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  await page.waitForTimeout(2000);

  await page.goto(`${BASE_URL}/dashboard/logistics`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500);

  // Scroll down to tables
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "5_logistics_tables_empty_state.png"), fullPage: false });
  console.log("   ✓ Captured 5_logistics_tables_empty_state.png");

  // Scroll further down to bottom of sidebar showing Transfer & Handover Center
  await page.evaluate(() => window.scrollTo(0, 0));
  const shippingMenuBtn = page.locator('button:has-text("Shipping & Clearing"), div:has-text("Shipping & Clearing")').first();
  if (await shippingMenuBtn.isVisible()) {
    const isExpanded = await page.locator('a[href*="/dashboard/logistics"]').first().isVisible().catch(() => false);
    if (!isExpanded) {
      await shippingMenuBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  // Scroll sidebar
  const sidebar = page.locator('nav, aside, [data-sidebar="true"]').first();
  await sidebar.evaluate((el) => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "6_sidebar_bottom_transfer_center.png"), fullPage: false });
  console.log("   ✓ Captured 6_sidebar_bottom_transfer_center.png");

  await browser.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
