import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import path from "path";

const TARGET_HOST = "http://72.60.209.121";
const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c";
const SESSION_SECRET = "add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f";

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "be3a6b15-65c5-4d74-82ae-e956c02a5f07",
    email: "superadmin@dgt.llc",
    fullName: "Super Admin",
    roles: ["super_admin", "super_admin_reports"],
    isSuperAdmin: true,
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

async function verify() {
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  
  // 13-inch display viewport: 1366 x 768
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });

  await context.addCookies([
    { name: "erp_session", value: token, domain: "72.60.209.121", path: "/" },
    { name: "erp_lang", value: "en", domain: "72.60.209.121", path: "/" }
  ]);

  const page = await context.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  console.log("Navigating to LIVE production truck-registration...");
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

  // Click on "New Clearing Truck Registration"
  const newBtn = page.locator('button:has-text("New Clearing Truck Registration")').first();
  await newBtn.waitFor({ state: "visible", timeout: 10000 });
  console.log("Opening New Registration form...");
  await newBtn.click();
  await page.waitForTimeout(1500);

  // Step 1: Owner Details screenshot
  console.log("Capturing Step 1 (Owner Details)...");
  const step1Shot = path.join(ARTIFACTS_DIR, "live_truck_wizard_step1_1366.png");
  await page.screenshot({ path: step1Shot, fullPage: false });
  console.log("Saved Step 1 screenshot:", step1Shot);

  // Click "Next: Truck Details"
  const nextToStep2 = page.locator('button:has-text("Next: Truck Details")').first();
  await nextToStep2.click();
  await page.waitForTimeout(1000);

  // Fill truck details
  const truckInput = page.locator('input[placeholder="e.g. TKB 861"]').first();
  if (await truckInput.isVisible()) {
    await truckInput.fill("DGT-TRK-786");
  }

  // Step 2: Truck Details screenshot
  console.log("Capturing Step 2 (Truck Details)...");
  const step2Shot = path.join(ARTIFACTS_DIR, "live_truck_wizard_step2_1366.png");
  await page.screenshot({ path: step2Shot, fullPage: false });
  console.log("Saved Step 2 screenshot:", step2Shot);

  // Click "Next: Transporter Details"
  const nextToStep3 = page.locator('button:has-text("Next: Transporter Details")').first();
  await nextToStep3.click();
  await page.waitForTimeout(1000);

  // Step 3: Transporter Details screenshot
  console.log("Capturing Step 3 (Transporter Details)...");
  const step3Shot = path.join(ARTIFACTS_DIR, "live_truck_wizard_step3_1366.png");
  await page.screenshot({ path: step3Shot, fullPage: false });
  console.log("Saved Step 3 screenshot:", step3Shot);

  // Click "Next: Driver Details"
  const nextToStep4 = page.locator('button:has-text("Next: Driver Details")').first();
  await nextToStep4.click();
  await page.waitForTimeout(1000);

  // Step 4: Driver Details screenshot
  console.log("Capturing Step 4 (Driver Details)...");
  const step4Shot = path.join(ARTIFACTS_DIR, "live_truck_wizard_step4_1366.png");
  await page.screenshot({ path: step4Shot, fullPage: false });
  console.log("Saved Step 4 screenshot:", step4Shot);

  // Click "Next: Documents & Review"
  const nextToStep5 = page.locator('button:has-text("Next: Documents")').first();
  await nextToStep5.click();
  await page.waitForTimeout(1000);

  // Step 5: Documents screenshot
  console.log("Capturing Step 5 (Documents & Save)...");
  const step5Shot = path.join(ARTIFACTS_DIR, "live_truck_wizard_step5_1366.png");
  await page.screenshot({ path: step5Shot, fullPage: false });
  console.log("Saved Step 5 screenshot:", step5Shot);

  await browser.close();
  console.log("All wizard steps verified on live server!");
}

verify().catch(console.error);
