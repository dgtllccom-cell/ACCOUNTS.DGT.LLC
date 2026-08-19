import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("==> 1. Logging in as Super Admin...");
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
  await page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3000);

  const languages = [
    { code: "en", name: "English", rtl: false },
    { code: "ur", name: "Urdu", rtl: true },
    { code: "ps", name: "Pashto", rtl: true },
    { code: "fa", name: "Farsi", rtl: true },
    { code: "ar", name: "Arabic", rtl: true }
  ];

  const results = [];

  for (const lang of languages) {
    console.log(`\n==> Testing Sidebar in ${lang.name} (${lang.code})...`);
    
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Set language in cookie and localStorage
    await page.evaluate(({ code }) => {
      localStorage.setItem("erp_lang", code);
      document.cookie = `erp_lang=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }, { code: lang.code });

    await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Open sidebar drawer by clicking hamburger menu
    const menuBtn = page.locator('header button:has(svg.lucide-menu), header button:has-text("Dashboard"), button[aria-label*="navigation"]').first();
    if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(800);
    }

    // Check presence of "All Release Entries"
    const allReleaseLink = page.locator('aside a[href="/dashboard/all-release-entries"]').first();
    const hasAllRelease = (await allReleaseLink.count()) > 0;

    // Check absence of "New Entries" link or redundant container
    const newEntryLink = page.locator('aside a[href="/dashboard/new-entry"]');
    const hasOldNewEntry = (await newEntryLink.count()) > 0;

    // Check presence of General Office Management
    const genOfficeLink = page.locator('aside a[href*="/dashboard/general-office/employees"]').first();
    const hasGenOffice = (await genOfficeLink.count()) > 0;

    // Count instances of "All Release Entries" link in sidebar
    const allReleaseCount = await page.locator('aside a[href="/dashboard/all-release-entries"]').count();

    const pass = hasAllRelease && !hasOldNewEntry && hasGenOffice && allReleaseCount === 1;

    results.push({
      language: lang.name,
      code: lang.code,
      rtl: lang.rtl ? "RTL" : "LTR",
      allReleaseEntriesPresent: hasAllRelease,
      allReleaseCount: allReleaseCount,
      oldNewEntryRemoved: !hasOldNewEntry,
      generalOfficePresent: hasGenOffice,
      pass: pass
    });

    await page.screenshot({ path: `C:/Users/dgtll/.gemini/antigravity-ide/brain/7c714624-7346-45ba-a2cc-e298bf3f1ed4/screenshots/sidebar_${lang.code}.png` });

    // Close drawer
    const closeBtn = page.locator('aside button[aria-label*="navigation"], aside button:has(svg.lucide-x)').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 2. Test navigation to /dashboard/all-release-entries
  console.log("\n==> Testing click navigation to All Release Entries...");
  await page.evaluate(() => {
    localStorage.setItem("erp_lang", "en");
    document.cookie = `erp_lang=en; Path=/; Max-Age=31536000; SameSite=Lax`;
  });
  await page.goto("http://localhost:3000/dashboard/all-release-entries", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const currentUrl = page.url();
  const allReleasePageTitle = await page.innerText("body");
  const onAllReleasePage = currentUrl.includes("/dashboard/all-release-entries") && !allReleasePageTitle.includes("Module Temporary Exception");

  console.log("\n=================== SIDEBAR CLEANUP AUDIT RESULTS ===================");
  console.table(results);
  console.log(`\nAll Release Entries route navigation verification: ${onAllReleasePage ? "✅ PASS" : "❌ FAIL"}`);

  await browser.close();
}

main().catch(err => {
  console.error("Sidebar test failed:", err);
  process.exit(1);
});
