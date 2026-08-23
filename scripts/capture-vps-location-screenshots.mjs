import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/439657d1-c86c-4ac2-b5e8-c9bd3e29b8df";
const BASE_URL = "http://72.60.209.121";

async function capture() {
  console.log("Launching Chromium to capture live VPS screenshots...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log("Navigating to auth login page...");
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: "networkidle", timeout: 30000 });

  // Fill login
  console.log("Filling login form...");
  await page.fill('#identifier, input[name="identifier"]', "superadmin@dgt.llc");
  await page.fill('#password, input[name="password"]', "AdminPassword123!");
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  console.log("Current URL after login:", page.url());

  // 1. English Location Management
  console.log("Navigating to Location Management (EN)...");
  await context.addCookies([
    { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" },
    { name: "NEXT_LOCALE", value: "en", domain: "72.60.209.121", path: "/" }
  ]);
  await page.goto(`${BASE_URL}/dashboard/settings/location`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const pathEnLocation = path.join(ARTIFACTS_DIR, "vps_location_management_en.png");
  await page.screenshot({ path: pathEnLocation, fullPage: true });
  console.log("Saved:", pathEnLocation);

  // 2. Urdu Location Management
  console.log("Navigating to Location Management (UR)...");
  await context.addCookies([
    { name: "erp_lang", value: "ur", domain: "72.60.209.121", path: "/" },
    { name: "NEXT_LOCALE", value: "ur", domain: "72.60.209.121", path: "/" }
  ]);
  await page.goto(`${BASE_URL}/dashboard/settings/location?lang=ur`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const pathUrLocation = path.join(ARTIFACTS_DIR, "vps_location_management_ur.png");
  await page.screenshot({ path: pathUrLocation, fullPage: true });
  console.log("Saved:", pathUrLocation);

  // 3. English Branch Entry (Side-by-Side)
  console.log("Navigating to City Branch Entry (EN)...");
  await context.addCookies([
    { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" },
    { name: "NEXT_LOCALE", value: "en", domain: "72.60.209.121", path: "/" }
  ]);
  await page.goto(`${BASE_URL}/dashboard/new-entry/branch-entry/city-branch`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const pathEnBranch = path.join(ARTIFACTS_DIR, "vps_branch_entry_side_by_side_en.png");
  await page.screenshot({ path: pathEnBranch, fullPage: true });
  console.log("Saved:", pathEnBranch);

  // 4. Urdu Branch Entry (Side-by-Side)
  console.log("Navigating to City Branch Entry (UR)...");
  await context.addCookies([
    { name: "erp_lang", value: "ur", domain: "72.60.209.121", path: "/" },
    { name: "NEXT_LOCALE", value: "ur", domain: "72.60.209.121", path: "/" }
  ]);
  await page.goto(`${BASE_URL}/dashboard/new-entry/branch-entry/city-branch?lang=ur`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  const pathUrBranch = path.join(ARTIFACTS_DIR, "vps_branch_entry_side_by_side_ur.png");
  await page.screenshot({ path: pathUrBranch, fullPage: true });
  console.log("Saved:", pathUrBranch);

  await browser.close();
  console.log("All screenshots captured successfully!");
}

capture().catch(err => {
  console.error("Screenshot Error:", err);
  process.exit(1);
});
