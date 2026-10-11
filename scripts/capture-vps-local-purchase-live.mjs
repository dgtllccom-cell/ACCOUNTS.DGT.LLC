import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const TARGET_HOST = "http://72.60.209.121";
const ARTIFACT_DIR = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\598b5b63-5d46-4260-be6a-502973db1b96";
const SHOTS_DIR = path.join(ARTIFACT_DIR, "screenshots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const SESSION_SECRET = "add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f";

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"],
    assignments: [
      {
        role: "super_admin",
        countryId: null,
        countryBranchId: null,
        cityBranchId: null,
        operationalDomain: "both",
        mobileProfile: "standard"
      }
    ],
    createdAt: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

async function captureVps() {
  console.log("Capturing LIVE VPS Local Purchase at:", TARGET_HOST);
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });

  // 1. VPS Desktop Urdu (RTL)
  {
    console.log("Capturing VPS Desktop Urdu (RTL)...");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([
      { name: "erp_session", value: token, domain: "72.60.209.121", path: "/" },
      { name: "erp_lang", value: "ur", domain: "72.60.209.121", path: "/" }
    ]);
    const page = await ctx.newPage();
    await page.goto(`${TARGET_HOST}/dashboard/purchase/local-purchase`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    const shotPath = path.join(SHOTS_DIR, "vps-live-local-purchase-ur.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log("Saved VPS Urdu screenshot:", shotPath);
    await ctx.close();
  }

  // 2. VPS Desktop English
  {
    console.log("Capturing VPS Desktop English...");
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([
      { name: "erp_session", value: token, domain: "72.60.209.121", path: "/" },
      { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" }
    ]);
    const page = await ctx.newPage();
    await page.goto(`${TARGET_HOST}/dashboard/purchase/local-purchase`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    const shotPath = path.join(SHOTS_DIR, "vps-live-local-purchase-en.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log("Saved VPS English screenshot:", shotPath);
    await ctx.close();
  }

  // 3. VPS Mobile (iPhone Urdu RTL)
  {
    console.log("Capturing VPS iPhone Urdu (RTL)...");
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });
    await ctx.addCookies([
      { name: "erp_session", value: token, domain: "72.60.209.121", path: "/" },
      { name: "erp_lang", value: "ur", domain: "72.60.209.121", path: "/" }
    ]);
    const page = await ctx.newPage();
    await page.goto(`${TARGET_HOST}/dashboard/purchase/local-purchase`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    const shotPath = path.join(SHOTS_DIR, "vps-live-local-purchase-iphone-ur.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log("Saved VPS iPhone screenshot:", shotPath);
    await ctx.close();
  }

  await browser.close();
  console.log("VPS live captures completed!");
}

captureVps().catch(console.error);
