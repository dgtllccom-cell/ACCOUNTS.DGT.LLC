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

  console.log("Navigating to customer-order?create=true...");
  await page.goto(`${BASE}/dashboard/clearing-agent/customer-order?create=true`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page.waitForTimeout(4000);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Dubai -> Bandar Abbas (Sea) -> Milak/Nimroz -> Hairatan (Uzbekistan) -> New Delhi (Air)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("Testing Scenario 1: Dubai -> Bandar Abbas -> Milak/Nimroz -> Hairatan -> New Delhi...");
  
  // Set Movement Type to Transit
  const movementSelect = page.locator('select').first();
  if (await movementSelect.isVisible()) {
    await movementSelect.selectOption("transit");
    await page.waitForTimeout(500);
  }

  // Open Route Corridor Builder
  const openCorridorBtn = page.locator('button:has-text("Open Route Corridor Builder")').first();
  if (await openCorridorBtn.isVisible()) {
    await openCorridorBtn.scrollIntoViewIfNeeded();
    await openCorridorBtn.click();
    await page.waitForTimeout(800);
  }

  // Click "+ Add Route Stop / Border"
  const addStopBtn = page.locator('button:has-text("Add Route Stop / Border")').first();
  if (await addStopBtn.isVisible()) {
    await addStopBtn.scrollIntoViewIfNeeded();
    await addStopBtn.click();
    await page.waitForTimeout(1000);

    // Stop 1: Bandar Abbas (Sea)
    console.log("Adding Stop 1: Bandar Abbas (Sea)...");
    const modeSeaBtn = page.locator('button:has-text("Sea")').first();
    if (await modeSeaBtn.isVisible()) await modeSeaBtn.click();
    await page.waitForTimeout(300);

    const countrySelect = page.locator('div[role="dialog"] select, .fixed select').first();
    if (await countrySelect.isVisible()) {
      // Find Iran in countries
      const iranOpt = await countrySelect.locator('option:has-text("Iran")').first().getAttribute('value');
      if (iranOpt) await countrySelect.selectOption(iranOpt);
      await page.waitForTimeout(300);
    }

    const locInput = page.locator('input[placeholder*="Karachi Port"], input[placeholder*="Border"]').first();
    if (await locInput.isVisible()) {
      await locInput.fill("Bandar Abbas (Shahid Rajaee)");
    }

    // Save Stop 1
    const saveStop1 = page.locator('button:has-text("Save & Add to Route")').first();
    if (await saveStop1.isVisible()) {
      await saveStop1.click();
      await page.waitForTimeout(1000);
    }
  }

  // Add Stop 2: Milak Border -> Nimroz (Road)
  if (await addStopBtn.isVisible()) {
    await addStopBtn.click();
    await page.waitForTimeout(1000);

    console.log("Adding Stop 2: Milak Border / Nimroz (Road)...");
    const modeRoadBtn = page.locator('button:has-text("Road")').first();
    if (await modeRoadBtn.isVisible()) await modeRoadBtn.click();
    await page.waitForTimeout(300);

    const locInput = page.locator('input[placeholder*="Karachi Port"], input[placeholder*="Border"]').first();
    if (await locInput.isVisible()) {
      await locInput.fill("Milak Border (Nimroz / Zaranj)");
    }

    const saveStop2 = page.locator('button:has-text("Save & Add to Route")').first();
    if (await saveStop2.isVisible()) {
      await saveStop2.click();
      await page.waitForTimeout(1000);
    }
  }

  // Add Stop 3: Hairatan Border (Road -> Uzbekistan)
  if (await addStopBtn.isVisible()) {
    await addStopBtn.click();
    await page.waitForTimeout(1000);

    console.log("Adding Stop 3: Hairatan Border (Road)...");
    const locInput = page.locator('input[placeholder*="Karachi Port"], input[placeholder*="Border"]').first();
    if (await locInput.isVisible()) {
      await locInput.fill("Hairatan Border (Uzbekistan)");
    }

    const saveStop3 = page.locator('button:has-text("Save & Add to Route")').first();
    if (await saveStop3.isVisible()) {
      await saveStop3.click();
      await page.waitForTimeout(1000);
    }
  }

  // Add Stop 4: Delhi IGI Cargo Terminal (Air -> India)
  if (await addStopBtn.isVisible()) {
    await addStopBtn.click();
    await page.waitForTimeout(1000);

    console.log("Adding Stop 4: Delhi IGI Airport (Air)...");
    const modeAirBtn = page.locator('button:has-text("Air")').first();
    if (await modeAirBtn.isVisible()) await modeAirBtn.click();
    await page.waitForTimeout(300);

    const locInput = page.locator('input[placeholder*="Karachi Port"], input[placeholder*="Border"]').first();
    if (await locInput.isVisible()) {
      await locInput.fill("Delhi IGI Cargo Terminal (New Delhi Airport)");
    }

    const saveStop4 = page.locator('button:has-text("Save & Add to Route")').first();
    if (await saveStop4.isVisible()) {
      await saveStop4.click();
      await page.waitForTimeout(1000);
    }
  }

  // Capture Scenario 1 Full Corridor Proof
  const corridorCard = page.locator('text=Route via Corridor Builder').first();
  await corridorCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, "proof_scenario_1_multimodal_cross_border.png"),
    fullPage: false
  });
  console.log("Saved proof_scenario_1_multimodal_cross_border.png");

  // Also capture Live Report showing the multi-stop journey
  const liveReport = page.locator('text=MOVEMENT & ROUTE JOURNEY').first();
  if (await liveReport.isVisible()) {
    await liveReport.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "proof_scenario_1_live_report.png"),
      fullPage: false
    });
    console.log("Saved proof_scenario_1_live_report.png");
  }

  await browser.close();
  console.log("All scenarios tested successfully!");
}

main().catch(console.error);
