import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE || "http://localhost:3000";
const ARTIFACT_DIR = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\598b5b63-5d46-4260-be6a-502973db1b96";
const SHOTS_DIR = path.join(ARTIFACT_DIR, "screenshots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function getSessionToken() {
  const res = await fetch(`${BASE_URL}/api/erp/auth/dev-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "super_admin" }),
  });
  const cookieHeader = res.headers.get("set-cookie") || "";
  const match = cookieHeader.match(/erp_session=([^;]+)/);
  if (!match) throw new Error("Failed to get erp_session cookie");
  return match[1];
}

async function capture() {
  console.log("Starting screenshot capture for Local Purchase approved design...");
  const token = await getSessionToken();
  console.log("Got super_admin session token.");

  const browser = await chromium.launch({ headless: true });

  const runs = [
    // Desktop in all 5 languages
    { name: "lp-desktop-en", lang: "en", width: 1440, height: 900, isMobile: false },
    { name: "lp-desktop-ur-rtl", lang: "ur", width: 1440, height: 900, isMobile: false },
    { name: "lp-desktop-ar-rtl", lang: "ar", width: 1440, height: 900, isMobile: false },
    { name: "lp-desktop-fa-rtl", lang: "fa", width: 1440, height: 900, isMobile: false },
    { name: "lp-desktop-ps-rtl", lang: "ps", width: 1440, height: 900, isMobile: false },

    // Mobile: iPhone 15 (English & Urdu RTL)
    { name: "lp-iphone15-en", lang: "en", width: 393, height: 852, isMobile: true, dpr: 3 },
    { name: "lp-iphone15-ur-rtl", lang: "ur", width: 393, height: 852, isMobile: true, dpr: 3 },

    // Mobile: Samsung Galaxy (English & Urdu RTL)
    { name: "lp-samsung-en", lang: "en", width: 412, height: 915, isMobile: true, dpr: 3 },
    { name: "lp-samsung-ur-rtl", lang: "ur", width: 412, height: 915, isMobile: true, dpr: 3 },

    // iPad / Tablet (English & Urdu RTL)
    { name: "lp-ipad-en", lang: "en", width: 820, height: 1180, isMobile: true, dpr: 2 },
    { name: "lp-ipad-ur-rtl", lang: "ur", width: 820, height: 1180, isMobile: true, dpr: 2 },
  ];

  for (const cfg of runs) {
    console.log(`Capturing: ${cfg.name} (lang: ${cfg.lang}, ${cfg.width}x${cfg.height})...`);
    const context = await browser.newContext({
      viewport: { width: cfg.width, height: cfg.height },
      deviceScaleFactor: cfg.dpr || 1,
      isMobile: cfg.isMobile,
      hasTouch: cfg.isMobile,
    });

    await context.addCookies([
      { name: "erp_session", value: token, domain: "localhost", path: "/" },
      { name: "erp_lang", value: cfg.lang, domain: "localhost", path: "/" },
      { name: "erp_theme_mode", value: "day", domain: "localhost", path: "/" },
    ]);

    await context.addInitScript((l) => {
      try {
        localStorage.setItem("erp_lang", l);
        localStorage.setItem("erp_theme_mode", "day");
        localStorage.setItem("erp_app_install_dismissed", "1");
      } catch {}
    }, cfg.lang);

    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/dashboard/purchase/local-purchase`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      // Wait for table or cards to load
      await page.waitForTimeout(4000);

      const filePath = path.join(SHOTS_DIR, `${cfg.name}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`Saved: ${filePath}`);

      // For desktop Urdu, also capture with the FILTERS popup opened
      if (cfg.name === "lp-desktop-ur-rtl") {
        const filterBtn = page.locator("button:has-text('Filters'), button:has-text('فلٹرز')").first();
        if (await filterBtn.isVisible()) {
          await filterBtn.click();
          await page.waitForTimeout(1000);
          const filterShot = path.join(SHOTS_DIR, "lp-desktop-ur-filters-open.png");
          await page.screenshot({ path: filterShot, fullPage: false });
          console.log(`Saved: ${filterShot}`);
        }
      }
    } catch (err) {
      console.error(`Error capturing ${cfg.name}:`, err.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log("All screenshots captured successfully.");
}

capture().catch(console.error);
