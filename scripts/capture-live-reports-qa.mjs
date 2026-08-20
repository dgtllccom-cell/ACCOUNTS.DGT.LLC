import { chromium } from "@playwright/test";

const LANGUAGES = [
  { code: "ur", name: "Urdu", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "ps", name: "Pashto", dir: "rtl" },
  { code: "fa", name: "Farsi", dir: "rtl" },
  { code: "ar", name: "Arabic", dir: "rtl" },
];

async function main() {
  console.log("==> Starting live visual capture for 5 languages...");
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1550, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // 1. Log in as Super Admin
  console.log("==> Logging in as Super Admin...");
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  const superAdminTab = page.locator('button:has-text("Super Admin")').first();
  if (await superAdminTab.count() > 0) {
    await superAdminTab.click();
    await page.waitForTimeout(500);
  }
  await page.fill('#identifier', "superadmin@damaan.com");
  await page.fill('#password', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  for (const lang of LANGUAGES) {
    console.log(`\n==> Capturing Roznamcha All Reports in ${lang.name} (${lang.code})...`);
    
    // Set cookie and localStorage
    await context.addCookies([
      { name: "erp_lang", value: lang.code, domain: "localhost", path: "/" }
    ]);

    await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.evaluate((l) => {
      const rtlLanguages = ["ar", "ur", "fa", "ps"];
      document.documentElement.lang = l;
      document.documentElement.dir = rtlLanguages.includes(l) ? "rtl" : "ltr";
      localStorage.setItem("erp_lang", l);
      document.cookie = `erp_lang=${encodeURIComponent(l)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.dispatchEvent(new Event("erp_language_changed"));
    }, lang.code);
    await page.waitForTimeout(1000);

    // Navigate to All Roznamcha Report
    await page.goto("http://localhost:3000/dashboard/roznamcha/reports/all", { waitUntil: "networkidle" }).catch(() => page.waitForTimeout(3000));
    await page.waitForTimeout(2000);

    const shotPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/live_roznamcha_all_${lang.code}.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot to: ${shotPath}`);

    // Navigate to Cash Entry / Daily Payment
    console.log(`==> Capturing Cash Entry in ${lang.name} (${lang.code})...`);
    await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", { waitUntil: "networkidle" }).catch(() => page.waitForTimeout(3000));
    await page.waitForTimeout(2000);

    const cashShotPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/live_cash_entry_${lang.code}.png`;
    await page.screenshot({ path: cashShotPath, fullPage: false });
    console.log(`Saved screenshot to: ${cashShotPath}`);
  }

  await browser.close();
  console.log("\n✅ All live screenshots captured!");
}

main().catch(err => {
  console.error("Capture error:", err);
  process.exit(1);
});
