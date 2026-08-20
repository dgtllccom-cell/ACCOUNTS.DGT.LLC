import { chromium } from "@playwright/test";

const LANGUAGES = [
  { code: "fa", name: "Farsi" },
  { code: "ar", name: "Arabic" },
];

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1550, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // 1. Log in
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
    console.log(`==> Capturing ${lang.name} (${lang.code})...`);
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

    // Roznamcha All
    await page.goto("http://localhost:3000/dashboard/roznamcha/reports/all", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const shotPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/live_roznamcha_all_${lang.code}.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot: ${shotPath}`);

    // Cash Entry
    await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const cashShotPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/live_cash_entry_${lang.code}.png`;
    await page.screenshot({ path: cashShotPath, fullPage: false });
    console.log(`Saved cash screenshot: ${cashShotPath}`);
  }

  await browser.close();
  console.log("Finished FA and AR capture!");
}

main().catch(console.error);
