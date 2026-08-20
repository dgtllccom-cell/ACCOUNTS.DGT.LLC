import { chromium } from "@playwright/test";

const LANGUAGES = [
  { code: "ur", name: "Urdu" },
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "fa", name: "Farsi" },
  { code: "ps", name: "Pashto" }
];

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1550, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  // Set auth cookie
  await context.addCookies([
    { name: "erp_auth_token", value: "mock-super-admin-token", url: "http://localhost:3000" },
    { name: "erp_user_role", value: "SUPER_ADMIN", url: "http://localhost:3000" }
  ]);

  // Log in
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const idInput = page.locator('#identifier, input[name="identifier"]');
  if (await idInput.count() > 0) {
    const superAdminTab = page.locator('button:has-text("Super Admin")').first();
    if (await superAdminTab.count() > 0) {
      await superAdminTab.click();
      await page.waitForTimeout(500);
    }
    await idInput.first().fill("superadmin@damaan.com");
    await page.fill('#password, input[name="password"]', "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  for (const lang of LANGUAGES) {
    console.log(`==> Capturing ${lang.name} (${lang.code})...`);
    await context.addCookies([
      { name: "erp_lang", value: lang.code, url: "http://localhost:3000" }
    ]);
    await page.goto("http://localhost:3000/dashboard/roznamcha/reports/all", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.evaluate((l) => {
      const rtlLanguages = ["ar", "ur", "fa", "ps"];
      document.documentElement.lang = l;
      document.documentElement.dir = rtlLanguages.includes(l) ? "rtl" : "ltr";
      localStorage.setItem("erp_lang", l);
      document.cookie = `erp_lang=${encodeURIComponent(l)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.dispatchEvent(new Event("erp_language_changed"));
    }, lang.code);
    
    // Wait until data or empty state is loaded
    await page.waitForSelector('table', { state: "visible", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const shotPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/final_roznamcha_all_${lang.code}.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved: ${shotPath}`);

    // Business Roznamcha
    await page.goto("http://localhost:3000/dashboard/roznamcha/reports/business", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.evaluate((l) => {
      const rtlLanguages = ["ar", "ur", "fa", "ps"];
      document.documentElement.lang = l;
      document.documentElement.dir = rtlLanguages.includes(l) ? "rtl" : "ltr";
      localStorage.setItem("erp_lang", l);
      document.cookie = `erp_lang=${encodeURIComponent(l)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.dispatchEvent(new Event("erp_language_changed"));
    }, lang.code);
    await page.waitForSelector('table', { state: "visible", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const bizPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/final_roznamcha_business_${lang.code}.png`;
    await page.screenshot({ path: bizPath, fullPage: false });
    console.log(`Saved: ${bizPath}`);
  }

  await browser.close();
  console.log("All screenshots captured successfully!");
}

main().catch(console.error);
