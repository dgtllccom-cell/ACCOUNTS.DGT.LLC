import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", err => console.log(`[BROWSER ERROR] ${err.message}`));

  console.log("Navigating to login...");
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle" });
  await page.click('button:has-text("SUPER ADMIN")');
  await page.click('button[type="submit"], button:has-text("SECURE ERP LOGIN")');
  await page.waitForTimeout(3000);

  console.log("Navigating to /dashboard/all-release-entries...");
  const res = await page.goto("http://localhost:3000/dashboard/all-release-entries", { waitUntil: "networkidle" });
  console.log("Page response status:", res?.status());
  await page.waitForTimeout(3000);

  const bodyText = await page.innerText("body");
  console.log("Body snippet:", bodyText.slice(0, 500));

  await page.screenshot({ path: "test_all_release_entries.png" });
  await browser.close();
}

run().catch(console.error);
