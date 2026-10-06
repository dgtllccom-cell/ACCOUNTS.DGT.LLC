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

  const BASE_URL = "http://72.60.209.121";

  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click({ noWaitAfter: true });

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
  await page.waitForTimeout(2000);

  await page.goto(`${BASE_URL}/dashboard/journal/purchase-order-payment/remaining`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: `${OUT_DIR}/debug_remaining_page.png` });

  const html = await page.locator("tbody").innerHTML().catch(() => "no tbody");
  console.log("TBODY HTML snippet:", html.slice(0, 500));

  await browser.close();
}

main().catch(console.error);
