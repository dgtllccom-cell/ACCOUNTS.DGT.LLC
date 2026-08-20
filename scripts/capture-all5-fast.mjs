import { chromium } from "@playwright/test";

const LANGUAGES = [
  { code: "ur", name: "Urdu" },
  { code: "ar", name: "Arabic" },
  { code: "fa", name: "Farsi" },
  { code: "ps", name: "Pashto" },
  { code: "en", name: "English" },
];

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1550, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  // 1. Log in
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "load" });
  await page.waitForTimeout(500);
  const idInput = page.locator('input[name="identifier"], input[type="text"]').first();
  await idInput.fill("superadmin@damaan.com");
  const pwdInput = page.locator('input[name="password"], input[type="password"]').first();
  await pwdInput.fill("Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  for (const lang of LANGUAGES) {
    console.log(`==> Capturing ${lang.name} (${lang.code})...`);
    await context.addCookies([
      { name: "erp_lang", value: lang.code, domain: "localhost", path: "/" }
    ]);
    await page.goto("http://localhost:3000/dashboard/roznamcha/reports/all", { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.evaluate((l) => {
      const rtlLanguages = ["ar", "ur", "fa", "ps"];
      document.documentElement.lang = l;
      document.documentElement.dir = rtlLanguages.includes(l) ? "rtl" : "ltr";
      localStorage.setItem("erp_lang", l);
      document.cookie = `erp_lang=${encodeURIComponent(l)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.dispatchEvent(new Event("erp_language_changed"));
    }, lang.code);
    await page.waitForTimeout(1500);

    const shotPath = `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/live_roznamcha_all_${lang.code}.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot: ${shotPath}`);
  }

  await browser.close();
  console.log("All 5 languages captured successfully!");
}

main().catch(console.error);
