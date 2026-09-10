import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TEST_PASSWORD = process.env.DGT_TEST_PASSWORD;
if (!TEST_PASSWORD) {
  console.error("Set DGT_TEST_PASSWORD in your local .env (see scripts/rotate-debug-test-password.mjs).");
  process.exit(1);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Logging in...");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN")').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

  console.log("Navigating to /dashboard/roznamcha/cash-entry...");
  await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const outDir = path.resolve("C:/Users/dgtll/.gemini/antigravity-ide/brain/a3f34691-9266-4108-9d58-73a4b9b0aa86");
  await page.screenshot({ path: path.join(outDir, "debug_roznamcha_page.png") });

  const html = await page.content();
  fs.writeFileSync("debug_roznamcha.html", html);
  console.log("Saved screenshot debug_roznamcha_page.png and debug_roznamcha.html");

  // Check buttons
  const buttons = await page.locator("button").allInnerTexts();
  console.log("Buttons on page:", buttons.filter(b => b.trim().length > 0));

  await browser.close();
}

run().catch(console.error);
