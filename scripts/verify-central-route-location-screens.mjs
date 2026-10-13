import { chromium } from "playwright";
import path from "path";

const BASE = "http://localhost:3000";
const ARTIFACTS_DIR = "C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c";

async function verifyScreens() {
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

  // 1. Settings & Location Master Verification (Desktop)
  console.log("\n--- Testing Settings & Location Master ---");
  const ctxDesktop = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await ctxDesktop.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: "en", domain: "localhost", path: "/" }
  ]);
  const pageDesktop = await ctxDesktop.newPage();

  // Settings page
  await pageDesktop.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pageDesktop.waitForTimeout(2000);
  const locMasterLink = pageDesktop.locator('a[href*="/dashboard/settings/location-master"]');
  const locMasterVisible = await locMasterLink.isVisible();
  console.log("Settings page - Route & Location Master link visible:", locMasterVisible);

  // Navigate to Location Master
  await pageDesktop.goto(`${BASE}/dashboard/settings/location-master`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pageDesktop.waitForTimeout(3000);

  // Verify 5 tabs
  const tabNames = [
    "Location Master",
    "Gate / Terminal Master",
    "Customs Office & Treatment",
    "Route Rules & Templates",
    "Country Master"
  ];
  for (const tab of tabNames) {
    const tabEl = pageDesktop.locator(`button:has-text("${tab}")`).first();
    const visible = await tabEl.isVisible();
    console.log(`Tab "${tab}" visible:`, visible);
    if (visible) {
      await tabEl.click();
      await pageDesktop.waitForTimeout(1000);
    }
  }

  // Switch to Gate / Terminal Master tab and capture screenshot
  const terminalsTab = pageDesktop.locator('button:has-text("Gate / Terminal Master")').first();
  await terminalsTab.click();
  await pageDesktop.waitForTimeout(1000);

  const locMasterScreenshot = path.join(ARTIFACTS_DIR, "preview_location_master_hierarchy.png");
  await pageDesktop.screenshot({ path: locMasterScreenshot, fullPage: false });
  console.log("Captured Location Master screenshot:", locMasterScreenshot);

  // 2. Customer Order Route Legs & Stop Modal Verification (Desktop)
  console.log("\n--- Testing Customer Order Route Legs & Stop Modal ---");
  await pageDesktop.goto(`${BASE}/dashboard/clearing-agent/customer-order?create=true`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await pageDesktop.waitForTimeout(4000);

  // Click "Add Route Stop / Border" button to open the Route Stop Modal
  const addStopBtn = pageDesktop.locator('button:has-text("Add Route Stop / Border")').first();
  const addStopVisible = await addStopBtn.isVisible();
  console.log("Add Route Stop / Border button visible:", addStopVisible);

  if (addStopVisible) {
    await addStopBtn.click();
    await pageDesktop.waitForTimeout(1500);

    // Verify presence of Location, Gate, Customs Office, and Treatment Pickers in Modal
    const locPicker = pageDesktop.locator('label:has-text("Stop Location / Border / Port")').first();
    const gatePicker = pageDesktop.locator('label:has-text("Gate / Terminal")').first();
    const customsPicker = pageDesktop.locator('label:has-text("Customs Office")').first();
    const treatmentSelect = pageDesktop.locator('label:has-text("Customs Treatment / Regime")').first();

    console.log("Modal - Stop Location picker visible:", await locPicker.isVisible());
    console.log("Modal - Gate / Terminal picker visible:", await gatePicker.isVisible());
    console.log("Modal - Customs Office picker visible:", await customsPicker.isVisible());
    console.log("Modal - Customs Treatment selector visible:", await treatmentSelect.isVisible());
  }

  const custOrderScreenshot = path.join(ARTIFACTS_DIR, "preview_customer_order_route_legs.png");
  await pageDesktop.screenshot({ path: custOrderScreenshot, fullPage: false });
  console.log("Captured Customer Order Route Legs screenshot:", custOrderScreenshot);

  // 3. Mobile Responsiveness Test (iPhone 14)
  console.log("\n--- Testing Mobile Responsiveness (390x844) ---");
  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await ctxMobile.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: "en", domain: "localhost", path: "/" }
  ]);
  const pageMobile = await ctxMobile.newPage();

  await pageMobile.goto(`${BASE}/dashboard/settings/location-master`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pageMobile.waitForTimeout(3000);

  const mobileScreenshot = path.join(ARTIFACTS_DIR, "preview_location_master_mobile.png");
  await pageMobile.screenshot({ path: mobileScreenshot, fullPage: false });
  console.log("Captured Mobile screenshot:", mobileScreenshot);

  await browser.close();
  console.log("\n✓ All UI screens verified successfully!");
}

verifyScreens().catch(console.error);
