import { chromium } from "@playwright/test";

async function verify() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", msg => console.log(`[CONSOLE ${msg.type()}]: ${msg.text()}`));
  page.on("pageerror", err => console.log(`[PAGE ERROR]: ${err.message}`));

  console.log("1. Navigating to login...");
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle" });
  await page.fill('input[name="identifier"], input[placeholder*="email" i], input[placeholder*="user" i]', "superadmin@damaan.com");
  await page.fill('input[name="password"], input[type="password"]', "Admin@123");
  await page.click('button[type="submit"], button:has-text("SECURE ERP LOGIN")');
  await page.waitForTimeout(4000);
  console.log("Logged in. Current URL:", page.url());

  console.log("2. Navigating to /dashboard/all-release-entries...");
  const res = await page.goto("http://localhost:3000/dashboard/all-release-entries", { waitUntil: "networkidle" });
  console.log("Status:", res?.status());
  await page.waitForTimeout(3000);

  const text = await page.innerText("body");
  if (text.includes("Module Temporary Exception")) {
    console.error("❌ FOUND ERROR: 'Module Temporary Exception' is displayed on the page!");
    console.log("Body error text:", text.slice(0, 1000));
  } else {
    console.log("✅ Page loaded successfully without Module Temporary Exception.");
    console.log("Page content snippet:", text.slice(0, 400));
  }

  await page.screenshot({ path: "all_release_entries_live_check.png" });
  await browser.close();
}

verify().catch(console.error);
