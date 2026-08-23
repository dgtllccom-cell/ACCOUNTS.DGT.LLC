import { chromium } from "playwright";
import path from "path";

const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/439657d1-c86c-4ac2-b5e8-c9bd3e29b8df";
const BASE_URL = "http://72.60.209.121";

async function captureDropdowns() {
  console.log("Capturing live VPS dropdown proof...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log("Logging in...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill('#identifier, input[name="identifier"]', "superadmin@dgt.llc");
  await page.fill('#password, input[name="password"]', "AdminPassword123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 1. English Branch Entry with Country Dropdown open / selected
  console.log("Opening Branch Entry (EN)...");
  await context.addCookies([
    { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" },
    { name: "NEXT_LOCALE", value: "en", domain: "72.60.209.121", path: "/" }
  ]);
  await page.goto(`${BASE_URL}/dashboard/new-entry/branch-entry/city-branch`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Focus and click Country dropdown if present
  const countrySelect = page.locator('select').first();
  if (await countrySelect.count() > 0) {
    await countrySelect.click();
  }
  const pathEnDropdown = path.join(ARTIFACTS_DIR, "vps_branch_entry_dropdown_en.png");
  await page.screenshot({ path: pathEnDropdown, fullPage: true });
  console.log("Saved:", pathEnDropdown);

  // 2. Urdu Branch Entry with Country Dropdown open / selected
  console.log("Opening Branch Entry (UR)...");
  await context.addCookies([
    { name: "erp_lang", value: "ur", domain: "72.60.209.121", path: "/" },
    { name: "NEXT_LOCALE", value: "ur", domain: "72.60.209.121", path: "/" }
  ]);
  await page.goto(`${BASE_URL}/dashboard/new-entry/branch-entry/city-branch?lang=ur`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const countrySelectUr = page.locator('select').first();
  if (await countrySelectUr.count() > 0) {
    await countrySelectUr.click();
  }
  const pathUrDropdown = path.join(ARTIFACTS_DIR, "vps_branch_entry_dropdown_ur.png");
  await page.screenshot({ path: pathUrDropdown, fullPage: true });
  console.log("Saved:", pathUrDropdown);

  await browser.close();
  console.log("Dropdown screenshots captured successfully!");
}

captureDropdowns().catch(err => {
  console.error("Capture error:", err);
  process.exit(1);
});
