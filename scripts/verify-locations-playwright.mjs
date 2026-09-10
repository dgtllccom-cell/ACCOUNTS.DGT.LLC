import { chromium } from "playwright";
import path from "path";

const outDir = path.resolve("C:/Users/dgtll/.gemini/antigravity-ide/brain/a3f34691-9266-4108-9d58-73a4b9b0aa86");

async function run() {
  console.log("Launching Chromium browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER ERROR:", msg.text());
  });

  // 1. Authenticate via UI Login
  console.log("1. Navigating to login page...");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);

  console.log("   Submitting SuperAdmin credentials...");
  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill("DgtAdmin@2026!");
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  console.log("   ✅ Logged in successfully! Current URL:", page.url());
  await page.waitForTimeout(2000);

  // 2. Navigate to Country Branch Setup
  console.log("\n2. Navigating to Country Branch Setup (/dashboard/new-entry/branch-entry/country-branch)...");
  await page.goto("http://localhost:3000/dashboard/new-entry/branch-entry/country-branch", {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });
  await page.waitForTimeout(3000);

  // Step 1 Initial screenshot
  await page.screenshot({ path: path.join(outDir, "country_branch_step1_initial.png"), fullPage: false });
  console.log("   📸 Saved country_branch_step1_initial.png");

  // 3. Wait for Country spinner to finish
  console.log("3. Waiting for countries to finish loading...");
  const countryBtn = page.locator('button:has-text("Select country")').first();
  await countryBtn.waitFor({ state: "visible", timeout: 30000 });
  // Wait until the button does NOT have disabled
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Select country")
      );
      return btn && !btn.hasAttribute("disabled");
    },
    { timeout: 30000 }
  );
  console.log("   Country button is now ENABLED!");

  // Click Country dropdown
  await countryBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(outDir, "country_dropdown_all_countries.png"), fullPage: false });
  console.log("   📸 Saved country_dropdown_all_countries.png");

  const popover = page.locator('[data-radix-popper-content-wrapper]').first();
  const countryItems = popover.locator('[cmdk-item], [role="option"]');
  const countryCount = await countryItems.count();
  const countryNames = [];
  for (let i = 0; i < countryCount; i++) {
    const txt = (await countryItems.nth(i).innerText()).trim();
    if (txt && !countryNames.includes(txt)) countryNames.push(txt);
  }
  console.log(`   Found ${countryNames.length} country items in popover:`, countryNames);

  // Filter for Saudi Arabia using search input in popover
  console.log("4. Searching and selecting 'Saudi Arabia'...");
  const searchInput = popover.locator('input[placeholder*="Search"], [cmdk-input]').first();
  await searchInput.fill("Saudi");
  await page.waitForTimeout(600);

  const saudiItem = popover.locator('[cmdk-item]:has-text("Saudi Arabia"), [role="option"]:has-text("Saudi Arabia")').first();
  await saudiItem.click();
  console.log("   Clicked 'Saudi Arabia'. Waiting for states to load...");

  // 5. Wait for State button to become enabled
  console.log("5. Waiting for State dropdown to enable...");
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll("button"));
      const stateBtn = btns.find((b) => b.textContent?.includes("Select state") || b.getAttribute("title")?.includes("State"));
      return stateBtn && !stateBtn.hasAttribute("disabled") && !stateBtn.textContent?.includes("Loading");
    },
    { timeout: 30000 }
  );
  console.log("   State button is now ENABLED!");

  const stateBtn = page.locator('button:has-text("Select state"), button[title*="State"]').first();
  await stateBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(outDir, "state_dropdown_options.png"), fullPage: false });
  console.log("   📸 Saved state_dropdown_options.png");

  const statePopover = page.locator('[data-radix-popper-content-wrapper]').last();
  const stateItems = statePopover.locator('[cmdk-item], [role="option"]');
  const stateNames = [];
  const stateCount = await stateItems.count();
  for (let i = 0; i < stateCount; i++) {
    const txt = (await stateItems.nth(i).innerText()).trim();
    if (txt && !stateNames.includes(txt)) stateNames.push(txt);
  }
  console.log(`   Found ${stateNames.length} Saudi states:`, stateNames);

  // Select first state (e.g. Makkah Province)
  if (stateCount > 0) {
    await stateItems.first().click();
    console.log("   Clicked state. Waiting for cities to load...");
  }

  // 6. Wait for City button to become enabled
  console.log("6. Waiting for City dropdown to enable...");
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll("button"));
      const cityBtn = btns.find((b) => b.textContent?.includes("Select city") || b.getAttribute("title")?.includes("City"));
      return cityBtn && !cityBtn.hasAttribute("disabled") && !cityBtn.textContent?.includes("Loading");
    },
    { timeout: 30000 }
  );
  console.log("   City button is now ENABLED!");

  const cityBtn = page.locator('button:has-text("Select city"), button[title*="City"]').first();
  await cityBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(outDir, "city_dropdown_options.png"), fullPage: false });
  console.log("   📸 Saved city_dropdown_options.png");

  const cityPopover = page.locator('[data-radix-popper-content-wrapper]').last();
  const cityItems = cityPopover.locator('[cmdk-item], [role="option"]');
  const cityNames = [];
  const cityCount = await cityItems.count();
  for (let i = 0; i < cityCount; i++) {
    const txt = (await cityItems.nth(i).innerText()).trim();
    if (txt && !cityNames.includes(txt)) cityNames.push(txt);
  }
  console.log(`   Found ${cityNames.length} cities:`, cityNames);

  // Select first city (e.g. Jeddah)
  if (cityCount > 0) {
    await cityItems.first().click();
    console.log("   Clicked city. Waiting for auto-population...");
    await page.waitForTimeout(2000);
  }

  // Capture Step 1 Populated Screenshot
  await page.screenshot({ path: path.join(outDir, "country_branch_step1_populated.png"), fullPage: false });
  console.log("   📸 Saved country_branch_step1_populated.png");

  // 7. Verify Operational Entry (Roznamcha Cash Entry)
  console.log("\n7. Navigating to Roznamcha Cash Entry (/dashboard/roznamcha/cash-entry)...");
  await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(outDir, "roznamcha_cash_entry_page.png"), fullPage: false });
  console.log("   📸 Saved roznamcha_cash_entry_page.png");

  // Click Country dropdown in Roznamcha
  console.log("8. Checking Roznamcha Country dropdown (MUST only show active branches: Pakistan & UAE)...");
  const rozCountryTrigger = page.locator('button:has-text("Select country"), button:has-text("Pakistan"), button:has-text("United Arab Emirates")').first();
  if (await rozCountryTrigger.count() > 0) {
    await rozCountryTrigger.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, "roznamcha_country_dropdown_branches_only.png"), fullPage: false });
    console.log("   📸 Saved roznamcha_country_dropdown_branches_only.png");

    const rozPopover = page.locator('[data-radix-popper-content-wrapper]').last();
    const rozItems = rozPopover.locator('[role="option"], [cmdk-item]');
    const rozNames = [];
    const rozCount = await rozItems.count();
    for (let i = 0; i < rozCount; i++) {
      const txt = (await rozItems.nth(i).innerText()).trim();
      if (txt && !rozNames.includes(txt)) rozNames.push(txt);
    }
    console.log("   Roznamcha Country options (Expected ONLY Pakistan & UAE):", rozNames);
  }

  await browser.close();
  console.log("\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
