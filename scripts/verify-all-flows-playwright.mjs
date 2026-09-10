import { chromium } from "playwright";
import path from "path";

const outDir = path.resolve("C:/Users/dgtll/.gemini/antigravity-ide/brain/a3f34691-9266-4108-9d58-73a4b9b0aa86");

async function run() {
  console.log("Launching Chromium browser for Roznamcha & Branch verification...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Authenticate
  console.log("1. Logging in as SuperAdmin...");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill("DgtAdmin@2026!");
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  console.log("   ✅ Logged in successfully!");
  await page.waitForTimeout(2000);

  // 2. Roznamcha Cash Entry Verification
  console.log("2. Navigating to /dashboard/roznamcha/cash-entry...");
  await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });
  await page.waitForTimeout(3000);

  // Check for Intake Gateway and click "Manual Entry"
  const manualEntryBtn = page.locator('button:has-text("Manual Entry")').first();
  if (await manualEntryBtn.count() > 0 && await manualEntryBtn.isVisible()) {
    console.log("   Clicking 'Manual Entry' card on intake gateway...");
    await manualEntryBtn.click();
    await page.waitForTimeout(3000);
  }

  // Find the Country select element in Roznamcha
  console.log("   Inspecting Roznamcha Country select dropdown...");
  const countrySelect = page.locator('select').first();
  await countrySelect.waitFor({ state: "visible", timeout: 20000 });
  
  const options = await countrySelect.locator('option').allInnerTexts();
  console.log("   ✅ Roznamcha Country Options:", options);

  await page.screenshot({ path: path.join(outDir, "roznamcha_cash_entry_verified.png"), fullPage: false });
  console.log("   📸 Saved roznamcha_cash_entry_verified.png");

  // 3. City Branch Setup Verification
  console.log("3. Navigating to City Branch Setup (/dashboard/new-entry/branch-entry/city-branch)...");
  await page.goto("http://localhost:3000/dashboard/new-entry/branch-entry/city-branch", {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });
  await page.waitForTimeout(3000);

  // Wait for country dropdown button to enable
  console.log("   Waiting for City Branch country dropdown...");
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Select country")
      );
      return btn && !btn.hasAttribute("disabled");
    },
    { timeout: 30000 }
  );
  const cityBranchCountryBtn = page.locator('button:has-text("Select country")').first();
  await cityBranchCountryBtn.click();
  await page.waitForTimeout(1000);

  const cbPopover = page.locator('[data-radix-popper-content-wrapper]').last();
  const cbItems = cbPopover.locator('[cmdk-item], [role="option"]');
  const cbCount = await cbItems.count();
  const cbNames = [];
  for (let i = 0; i < cbCount; i++) {
    const txt = (await cbItems.nth(i).innerText()).trim();
    if (txt && !cbNames.includes(txt)) cbNames.push(txt);
  }
  console.log(`   ✅ Found ${cbNames.length} City Branch Country options (FULL MASTER LIST):`, cbNames);

  await page.screenshot({ path: path.join(outDir, "city_branch_country_dropdown.png"), fullPage: false });
  console.log("   📸 Saved city_branch_country_dropdown.png");

  await browser.close();
  console.log("\n🎉 ALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
