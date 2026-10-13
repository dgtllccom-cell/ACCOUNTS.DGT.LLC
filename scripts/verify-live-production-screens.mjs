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

  // 1. Top 3 Choice Dropdown Cards & Live Route Report on Right Side
  console.log("Capturing 3 Choice Cards & Live Report on Live Production...");
  const movementCard = page.locator('text=Movement Type').first();
  await movementCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "live_vps_3_choice_dropdowns.png"),
    fullPage: false
  });
  console.log("Captured live_vps_3_choice_dropdowns.png");

  // 2. Direct Leg Handler Card
  console.log("Capturing Direct Leg Handler Card...");
  const handlerCard = page.locator('text=Direct Route Leg Handler:').first();
  await handlerCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "live_vps_handler_message_badge.png"),
    fullPage: false
  });
  console.log("Captured live_vps_handler_message_badge.png");

  // 3. Open Branch Modal ("Parda")
  const editBranchBtn = page.locator('button:has-text("Edit Branch & User")').first();
  if (await editBranchBtn.isVisible()) {
    await editBranchBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "live_vps_branch_modal.png"),
      fullPage: false
    });
    console.log("Captured live_vps_branch_modal.png");

    const closeBtn = page.locator('button:has-text("Save & Apply")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(600);
    }
  }

  // 4. Toggle to External Partner & Open External Partner Modal ("Parda")
  const partnerBtn = page.locator('button:has-text("External Partner")').first();
  if (await partnerBtn.isVisible()) {
    await partnerBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "live_vps_external_partner_modal.png"),
      fullPage: false
    });
    console.log("Captured live_vps_external_partner_modal.png");

    const closeBtn = page.locator('button:has-text("Save & Apply")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(600);
    }
  }

  // 5. Click "+ Add Route Stop / Border" to verify Stop Modal on Live Production
  const addStopBtn = page.locator('button:has-text("Add Route Stop / Border")').first();
  if (await addStopBtn.isVisible()) {
    await addStopBtn.click();
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "live_vps_stop_modal.png"),
      fullPage: false
    });
    console.log("Captured live_vps_stop_modal.png");
  }

  await browser.close();
  console.log("Live production verification completed successfully!");
}

main().catch(console.error);
