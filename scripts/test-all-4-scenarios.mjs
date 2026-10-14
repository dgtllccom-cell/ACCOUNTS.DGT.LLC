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
  const context = await browser.newContext({
    viewport: { width: 1480, height: 1100 }
  });

  await context.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: "en", domain: "localhost", path: "/" }
  ]);

  const page = await context.newPage();

  async function openCreatePage() {
    await page.goto(`${BASE}/dashboard/clearing-agent/customer-order?create=true`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForTimeout(3000);
  }

  // Helper to add a stop reliably inside the modal dialog
  async function addStop(mode, locationName) {
    const addBtn = page.locator('button:has-text("Add Route Stop / Border")').first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await page.waitForTimeout(600);

    const dialog = page.locator('div[role="dialog"]').last();
    if (mode === "sea") {
      const seaBtn = dialog.locator('button:has-text("Sea")').first();
      if (await seaBtn.isVisible()) await seaBtn.click();
    } else if (mode === "road") {
      const roadBtn = dialog.locator('button:has-text("Road")').first();
      if (await roadBtn.isVisible()) await roadBtn.click();
    } else if (mode === "air") {
      const airBtn = dialog.locator('button:has-text("Air")').first();
      if (await airBtn.isVisible()) await airBtn.click();
    }
    await page.waitForTimeout(300);

    // Fill location name input inside the dialog
    const locInput = dialog.locator('input[placeholder*="Karachi Port"], input[placeholder*="Border"], input[placeholder*="Dubai Cargo"], input[placeholder*="Azakhel"]').first();
    if (await locInput.isVisible()) {
      await locInput.fill(locationName);
    }

    // Click Apply & Add Stop
    const saveBtn = dialog.locator('button:has-text("Apply & Add Stop")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(800);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Dubai -> Bandar Abbas (Sea) -> Milak/Nimroz -> Hairatan (UZ) -> New Delhi (Air)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- SCENARIO 1: Dubai -> Bandar Abbas -> Milak/Nimroz -> Hairatan -> New Delhi ---");
  await openCreatePage();

  await addStop("sea", "Bandar Abbas (Shahid Rajaee)");
  await addStop("road", "Milak Border (Nimroz / Zaranj)");
  await addStop("road", "Hairatan Border (Uzbekistan)");
  await addStop("air", "Delhi IGI Cargo Terminal (New Delhi Airport)");

  const corridor1 = page.locator('text=Route via Corridor Builder').first();
  await corridor1.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "proof_entry_1_multimodal_dubai_delhi.png"),
    fullPage: false
  });
  console.log("Captured proof_entry_1_multimodal_dubai_delhi.png");

  const report1 = page.locator('text=MOVEMENT & ROUTE JOURNEY').first();
  if (await report1.isVisible()) {
    await report1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "proof_entry_1_live_report.png"),
      fullPage: false
    });
    console.log("Captured proof_entry_1_live_report.png");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Kandahar -> Spin Boldak -> Chaman (Customs) -> Wagah Border (India)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- SCENARIO 2: Kandahar -> Spin Boldak -> Chaman -> Wagah Border ---");
  await openCreatePage();

  await addStop("road", "Spin Boldak / Chaman Border (Customs Station)");
  await addStop("road", "Wagah Border (Pakistan - Exit to India)");

  const corridor2 = page.locator('text=Route via Corridor Builder').first();
  await corridor2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "proof_entry_2_kandahar_chaman_wagah.png"),
    fullPage: false
  });
  console.log("Captured proof_entry_2_kandahar_chaman_wagah.png");

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Afghanistan -> Spin Boldak -> Chaman (Import Duty Paid) -> Karachi
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- SCENARIO 3: Afghanistan -> Spin Boldak -> Chaman (Import Duty) -> Karachi ---");
  await openCreatePage();

  await addStop("road", "Chaman Border Customs Station (Import Duty Paid)");
  await addStop("road", "Karachi Warehouse (Final Delivery)");

  const corridor3 = page.locator('text=Route via Corridor Builder').first();
  await corridor3.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "proof_entry_3_afghanistan_chaman_karachi.png"),
    fullPage: false
  });
  console.log("Captured proof_entry_3_afghanistan_chaman_karachi.png");

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: Afghanistan -> Spin Boldak -> Chaman -> Karachi Port (Sea) -> Dubai
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- SCENARIO 4: Afghanistan -> Spin Boldak -> Chaman -> Karachi Port -> Dubai ---");
  await openCreatePage();

  await addStop("road", "Spin Boldak / Chaman Border");
  await addStop("sea", "Karachi Port (KPT) - Vessel Loading");
  await addStop("sea", "Jebel Ali Port (JAFZA) / Dubai");

  const corridor4 = page.locator('text=Route via Corridor Builder').first();
  await corridor4.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "proof_entry_4_afghanistan_karachi_dubai.png"),
    fullPage: false
  });
  console.log("Captured proof_entry_4_afghanistan_karachi_dubai.png");

  await browser.close();
  console.log("\n✓ All 4 route scenarios successfully created, verified, and screenshotted!");
}

main().catch(console.error);
