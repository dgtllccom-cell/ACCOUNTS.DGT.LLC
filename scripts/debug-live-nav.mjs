import { chromium } from "playwright";
import path from "path";
import { createHmac } from "node:crypto";

const TARGET_HOST = "http://72.60.209.121";
const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c";
const SESSION_SECRET = "add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f";

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"],
    createdAt: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

async function main() {
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1480, height: 1100 }
  });

  await context.addCookies([
    { name: "erp_session", value: token, domain: "72.60.209.121", path: "/" },
    { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" }
  ]);

  const page = await context.newPage();

  console.log("Navigating to LIVE production customer-order?create=true...");
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page.waitForTimeout(4000);

  console.log("Current page URL:", page.url());
  console.log("Current page title:", await page.title());

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "live_production_pure_superadmin.png"),
    fullPage: false
  });
  console.log("Captured live_production_pure_superadmin.png");

  await browser.close();
}

main().catch(console.error);
