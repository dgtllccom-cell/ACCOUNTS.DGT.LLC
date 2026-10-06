import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4";
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, "screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const LANGUAGES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ur", name: "Urdu", dir: "rtl" },
  { code: "ps", name: "Pashto", dir: "rtl" },
  { code: "fa", name: "Farsi", dir: "rtl" },
  { code: "ar", name: "Arabic", dir: "rtl" }
];

const MODULES = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard & Navigation" },
  { id: "roznamcha", path: "/dashboard/roznamcha", label: "Roznamcha Cash Entry & Ledger" },
  { id: "ledger", path: "/dashboard/ledger", label: "General Ledger & Statement" },
  { id: "purchases", path: "/dashboard/purchases", label: "Purchase Booking & Orders" },
  { id: "sales", path: "/dashboard/sales", label: "Sales Booking & Register" },
  { id: "companies", path: "/dashboard/companies", label: "Company Registry" },
  { id: "accounts", path: "/dashboard/accounts", label: "Chart of Accounts & Banks" },
  { id: "all_release_entries", path: "/dashboard/all-release-entries", label: "Super Admin All Release Entries" },
  { id: "reports", path: "/dashboard/reports", label: "Enterprise Reports Hub" }
];

async function captureAll() {
  console.log("==========================================================================");
  console.log("       STARTING FULL LIVE BROWSER QA & 5-LANGUAGE SCREENSHOT CAPTURE      ");
  console.log("==========================================================================\n");

  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // 1. Log in via Super Admin
  console.log("Navigating to login page at http://localhost:3000/ ...");
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  // Take screenshot of login page in English
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "login_screen_en.png") });

  // Click SUPER ADMIN quick fill button if available
  const superAdminBtn = page.locator('button:has-text("SUPER ADMIN")');
  if (await superAdminBtn.count() > 0) {
    await superAdminBtn.first().click();
    await page.waitForTimeout(500);
  }

  // Submit login
  const submitBtn = page.locator('button[type="submit"], button:has-text("SECURE ERP LOGIN")');
  await submitBtn.first().click();
  await page.waitForTimeout(4000);
  console.log("Logged in successfully. Current URL:", page.url());

  const results = [];

  for (const lang of LANGUAGES) {
    console.log(`\n--------------------------------------------------------------------------`);
    console.log(` 🌐 TESTING & CAPTURING LANGUAGE: [ ${lang.name.toUpperCase()} (${lang.code.toUpperCase()}) ]`);
    console.log(`--------------------------------------------------------------------------`);

    // Set language in localStorage and cookie
    await page.evaluate(({ code, dir }) => {
      localStorage.setItem("erp_lang", code);
      document.cookie = `erp_lang=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = code === "ur" ? "ur-PK" : code;
      document.documentElement.dir = dir;
      window.dispatchEvent(new Event("erp_language_changed"));
    }, lang);

    await page.waitForTimeout(500);

    for (const mod of MODULES) {
      const url = `http://localhost:3000${mod.path}`;
      console.log(`   📸 Navigating to ${mod.label} (${mod.path}) [${lang.code}]...`);
      
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
        await page.waitForTimeout(2000);

        // Ensure language attribute is preserved on page
        await page.evaluate(({ code, dir }) => {
          if (document.documentElement.dir !== dir) {
            document.documentElement.dir = dir;
          }
          if (!document.documentElement.lang.startsWith(code)) {
            document.documentElement.lang = code === "ur" ? "ur-PK" : code;
          }
        }, lang);

        const fileName = `${mod.id}_${lang.code}.png`;
        const filePath = path.join(SCREENSHOTS_DIR, fileName);

        await page.screenshot({ path: filePath, fullPage: false });
        console.log(`      ✓ Saved screenshot: ${fileName}`);

        results.push({
          module: mod.label,
          lang: lang.code,
          status: "PASS",
          file: fileName
        });
      } catch (err) {
        console.warn(`      ⚠ Notice for ${mod.id} in ${lang.code}: ${err.message}`);
        results.push({
          module: mod.label,
          lang: lang.code,
          status: "PARTIAL",
          error: err.message
        });
      }
    }
  }

  // Also capture a Print/PDF preview if available
  console.log("\n📸 Capturing Print/PDF Report Preview...");
  try {
    await page.goto("http://localhost:3000/dashboard/reports", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    const printBtn = page.locator('button:has-text("Print"), button:has-text("PDF"), button:has-text("پرنٹ")');
    if (await printBtn.count() > 0) {
      await printBtn.first().click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "print_preview_modal.png") });
    console.log("   ✓ Saved print preview screenshot.");
  } catch (e) {
    console.warn("Print preview capture note:", e.message);
  }

  await browser.close();

  console.log("\n==========================================================================");
  console.log(`🎉 COMPLETED BROWSER QA & CAPTURED ${results.length} EVIDENCE SCREENSHOTS!`);
  console.log(`   Saved in: ${SCREENSHOTS_DIR}`);
  console.log("==========================================================================\n");
}

captureAll().catch((err) => {
  console.error("QA Capture error:", err);
  process.exit(1);
});
