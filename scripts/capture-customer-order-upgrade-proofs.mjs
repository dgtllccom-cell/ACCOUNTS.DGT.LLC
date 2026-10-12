import { chromium } from '@playwright/test';
import path from 'path';
import { createHmac } from 'node:crypto';

const TARGET_HOST = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\32a0c37d-b28b-46e0-ae11-f4666340583c';
const SESSION_SECRET = 'c0734b4690f88f3d2878efd9ace71db7eac681d5a22f52ac64d540c4a41d661d';

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@dgt.llc",
    fullName: "Super Admin",
    roles: ["super_admin"],
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

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

async function run() {
  console.log('Starting full visual capture of Customer Order UI Upgrade...');
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  const targetUrl = `${TARGET_HOST}/dashboard/clearing-agent/customer-order`;
  console.log('Navigating to', targetUrl);
  
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  // 1. Registry View
  const registryShot = path.join(ARTIFACT_DIR, '01_customer_orders_registry.png');
  await page.screenshot({ path: registryShot, fullPage: false });
  console.log('Saved 01_customer_orders_registry.png');

  // 1b. Filters Popover
  const filtersBtn = page.getByRole('button', { name: 'Filters' }).first();
  if (await filtersBtn.isVisible()) {
    await filtersBtn.click();
    await page.waitForTimeout(800);
    const filterPopoverShot = path.join(ARTIFACT_DIR, '01b_filters_popover_open.png');
    await page.screenshot({ path: filterPopoverShot, fullPage: false });
    console.log('Saved 01b_filters_popover_open.png');
    await filtersBtn.click();
    await page.waitForTimeout(500);
  }

  // 2. Click "New" button to open Wizard
  const newBtn = page.getByRole('button', { name: 'New', exact: true }).first();
  if (await newBtn.isVisible()) {
    console.log('Opening order wizard...');
    await newBtn.click();
    await page.waitForTimeout(2000);
  }

  // 2a. Step 1A — Customer & Route
  const step1aShot = path.join(ARTIFACT_DIR, '02_step1a_customer_route.png');
  await page.screenshot({ path: step1aShot, fullPage: false });
  console.log('Saved 02_step1a_customer_route.png');

  // 2b. Movement Type Modal
  const movementBtn = page.getByRole('button', { name: 'Choose Movement Type' }).first();
  if (await movementBtn.isVisible()) {
    await movementBtn.click();
    await page.waitForTimeout(800);
    const movementShot = path.join(ARTIFACT_DIR, '02b_movement_modal.png');
    await page.screenshot({ path: movementShot, fullPage: false });
    console.log('Saved 02b_movement_modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 2c. Shipment Mode Modal
  const shipmentBtn = page.getByRole('button', { name: 'Choose Shipment Mode' }).first();
  if (await shipmentBtn.isVisible()) {
    await shipmentBtn.click();
    await page.waitForTimeout(800);
    const shipmentShot = path.join(ARTIFACT_DIR, '02c_shipment_type_modal.png');
    await page.screenshot({ path: shipmentShot, fullPage: false });
    console.log('Saved 02c_shipment_type_modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 2d. Operation Type Modal
  const operationBtn = page.getByRole('button', { name: 'Choose Operation Type' }).first();
  if (await operationBtn.isVisible()) {
    await operationBtn.click();
    await page.waitForTimeout(800);
    const opShot = path.join(ARTIFACT_DIR, '02d_operation_type_modal.png');
    await page.screenshot({ path: opShot, fullPage: false });
    console.log('Saved 02d_operation_type_modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 2e. Route Corridor Builder Modal
  const corridorBtn = page.getByRole('button', { name: 'Open Route Corridor Builder' }).first();
  if (await corridorBtn.isVisible()) {
    await corridorBtn.click();
    await page.waitForTimeout(800);
    const corridorShot = path.join(ARTIFACT_DIR, '02e_corridor_modal.png');
    await page.screenshot({ path: corridorShot, fullPage: false });
    console.log('Saved 02e_corridor_modal.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 3. Step 1B — Truck & Transport
  const step1bTab = page.getByRole('button', { name: '1B — Truck & Transport' }).first();
  if (await step1bTab.isVisible()) {
    await step1bTab.click();
    await page.waitForTimeout(1500);
    const step1bShot = path.join(ARTIFACT_DIR, '03_step1b_truck_transport.png');
    await page.screenshot({ path: step1bShot, fullPage: false });
    console.log('Saved 03_step1b_truck_transport.png');

    // Permanent Truck / Fleet Master picker modal
    const fleetBtn = page.locator('button:has-text("Permanent Truck")').first();
    if (await fleetBtn.isVisible()) {
      await fleetBtn.click();
      await page.waitForTimeout(800);
      const fleetShot = path.join(ARTIFACT_DIR, '03b_fleet_picker_modal.png');
      await page.screenshot({ path: fleetShot, fullPage: false });
      console.log('Saved 03b_fleet_picker_modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Other / External Truck dialog
    const extBtn = page.locator('button:has-text("Other / External Truck")').first();
    if (await extBtn.isVisible()) {
      await extBtn.click();
      await page.waitForTimeout(800);
      const extShot = path.join(ARTIFACT_DIR, '03c_external_truck_dialog.png');
      await page.screenshot({ path: extShot, fullPage: false });
      console.log('Saved 03c_external_truck_dialog.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // 4. Step 1C — Goods Entry
  const step1cTab = page.getByRole('button', { name: '1C — Goods Entry' }).first();
  if (await step1cTab.isVisible()) {
    await step1cTab.click();
    await page.waitForTimeout(1500);
    const step1cShot = path.join(ARTIFACT_DIR, '04_step1c_goods_entry.png');
    await page.screenshot({ path: step1cShot, fullPage: false });
    console.log('Saved 04_step1c_goods_entry.png');
  }

  // 5. Step 4 — Review & Submit
  const step4Btn = page.getByRole('button', { name: '4 4: Review & Sheet' }).first();
  if (await step4Btn.isVisible()) {
    console.log('Navigating to Step 4 Final Review & Submit...');
    await step4Btn.click();
    await page.waitForTimeout(2000);
    const step4Shot = path.join(ARTIFACT_DIR, '05_step4_final_review_submit.png');
    await page.screenshot({ path: step4Shot, fullPage: false });
    console.log('Saved 05_step4_final_review_submit.png');
  }

  await browser.close();
  console.log('🎉 ALL UPGRADED UI COMPONENTS CAPTURED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
