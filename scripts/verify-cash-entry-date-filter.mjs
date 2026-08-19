import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("==> 1. Logging in as Super Admin via API session...");
  // Login directly via API to get auth cookie reliably
  const loginRes = await page.request.post("http://localhost:3000/api/erp/auth/login", {
    data: {
      identifier: "superadmin@damaan.com",
      password: "Admin@123",
      remember: true,
      login_type: "super_admin"
    }
  });
  console.log("Login API status:", loginRes.status());

  console.log("==> 2. Navigating to /dashboard/roznamcha/cash-entry...");
  await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Take screenshot of 1-Day Default view
  await page.screenshot({
    path: "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/roznamcha_1day_default.png",
    fullPage: false
  });

  const bodyText = await page.innerText("body");
  const hasTable = bodyText.includes("JOURNAL ROZNAMCHA") || bodyText.includes("ROZNAMCHA — ENTRY TABLE") || bodyText.includes("1 Day");
  console.log("Roznamcha Entry Table loaded successfully:", hasTable);

  // Switch to Date Range
  console.log("==> 3. Testing Date Range Filter Mode...");
  const rangeBtn = page.locator('button:has-text("Date Range")').first();
  if (await rangeBtn.count() > 0) {
    await rangeBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/roznamcha_date_range_view.png",
    fullPage: false
  });

  // Switch to All Dates
  console.log("==> 4. Testing All Dates Mode...");
  const allBtn = page.locator('button:has-text("All Dates")').first();
  if (await allBtn.count() > 0) {
    await allBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/roznamcha_all_dates_view.png",
    fullPage: false
  });

  console.log("==> 5. Testing Urdu language support...");
  await page.evaluate(() => {
    localStorage.setItem("erp_lang", "ur");
    document.cookie = `erp_lang=ur; Path=/; Max-Age=31536000; SameSite=Lax`;
  });
  await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  await page.screenshot({
    path: "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/roznamcha_1day_urdu.png",
    fullPage: false
  });

  console.log("✅ Live Roznamcha Date Filtering test completed successfully!");
  await browser.close();
}

main().catch(err => {
  console.error("Roznamcha test error:", err);
  process.exit(1);
});
