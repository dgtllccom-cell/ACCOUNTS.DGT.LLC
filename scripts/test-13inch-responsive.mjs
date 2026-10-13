import { chromium } from "playwright";
import path from "path";

const BASE = "http://localhost:3000";
const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c";

async function main() {
  console.log("Obtaining dev session token...");
  const authRes = await fetch(BASE + "/api/erp/auth/dev-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "super_admin" })
  });

  const rawCookies = authRes.headers.getSetCookie();
  const sessionCookie = rawCookies.map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="));
  const token = sessionCookie ? sessionCookie.slice("erp_session=".length) : "";

  const browser = await chromium.launch({ headless: true });

  // TEST 1: 1366x768 (Standard 13-inch display)
  console.log("Testing 1366x768 resolution (13-inch display)...");
  const ctx1366 = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });
  await ctx1366.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: "en", domain: "localhost", path: "/" }
  ]);
  const page1366 = await ctx1366.newPage();
  await page1366.goto(`${BASE}/dashboard/clearing-agent/customer-order?create=true`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page1366.waitForTimeout(4000);

  const tab1A = page1366.locator('button:has-text("1A")').first();
  if (await tab1A.isVisible()) {
    await tab1A.scrollIntoViewIfNeeded();
  }
  await page1366.waitForTimeout(1000);

  await page1366.screenshot({
    path: path.join(ARTIFACTS_DIR, "preview_13inch_1366x768_cards.png"),
    fullPage: false
  });
  console.log("Captured preview_13inch_1366x768_cards.png");

  // TEST 2: 1280x800 (13-inch MacBook / 1080p scaled)
  console.log("Testing 1280x800 resolution...");
  const ctx1280 = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  await ctx1280.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: "en", domain: "localhost", path: "/" }
  ]);
  const page1280 = await ctx1280.newPage();
  await page1280.goto(`${BASE}/dashboard/clearing-agent/customer-order?create=true`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page1280.waitForTimeout(4000);

  const tab1A_1280 = page1280.locator('button:has-text("1A")').first();
  if (await tab1A_1280.isVisible()) {
    await tab1A_1280.scrollIntoViewIfNeeded();
  }
  await page1280.waitForTimeout(1000);

  await page1280.screenshot({
    path: path.join(ARTIFACTS_DIR, "preview_13inch_1280x800_cards.png"),
    fullPage: false
  });
  console.log("Captured preview_13inch_1280x800_cards.png");

  await browser.close();
  console.log("✓ Done capturing 13-inch responsive previews!");
}

main().catch(console.error);
