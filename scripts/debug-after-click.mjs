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

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  console.log("Logging in...");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN")').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });

  console.log("Navigating to /dashboard/roznamcha/cash-entry...");
  await page.goto("http://localhost:3000/dashboard/roznamcha/cash-entry", { waitUntil: "domcontentloaded" });
  console.log("Waiting 5s for hydration...");
  await page.waitForTimeout(5000);

  console.log("Clicking Manual Entry card...");
  await page.locator('button:has-text("Open Form")').first().click();
  await page.waitForTimeout(4000);

  const outDir = path.resolve("C:/Users/dgtll/.gemini/antigravity-ide/brain/a3f34691-9266-4108-9d58-73a4b9b0aa86");
  await page.screenshot({ path: path.join(outDir, "after_manual_click.png"), fullPage: true });

  const selects = await page.locator("select").count();
  console.log("Number of <select> elements after clicking:", selects);

  for (let i = 0; i < selects; i++) {
    const sel = page.locator("select").nth(i);
    const visible = await sel.isVisible();
    const opts = await sel.locator("option").allInnerTexts();
    console.log(`Select #${i} (visible: ${visible}):`, opts.slice(0, 5));
  }

  // Also check if any error or crash occurred
  const text = await page.locator("body").innerText();
  if (text.includes("Error") || text.includes("Application error")) {
    console.log("PAGE ERROR FOUND in body text!");
  }

  await browser.close();
}

run().catch(console.error);
