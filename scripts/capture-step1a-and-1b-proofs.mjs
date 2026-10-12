import { chromium } from '@playwright/test';
import { createHmac } from 'node:crypto';
import path from 'path';

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
  console.log('Starting Playwright capture for Step 1A (Route Corridor Modal) & Step 1B (Truck Dropdown & 6 fields removed)...');
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, { waitUntil: 'domcontentloaded' });
  console.log('Waiting for initial data to load...');
  await page.waitForTimeout(14000);

  // 1. STEP 1A — ROUTE VIA CORRIDOR BUILDER VIEW
  console.log('Capturing Step 1A initial corridor view...');
  // Scroll to route corridor builder
  const corridorHeading = page.locator('text=ROUTE VIA CORRIDOR BUILDER').first();
  await corridorHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const shot1aInitial = path.join(ARTIFACT_DIR, '11_step1a_route_corridor_view.png');
  await page.screenshot({ path: shot1aInitial });
  console.log('Saved 11_step1a_route_corridor_view.png');

  // 2. Open Route Stop / Border Modal ("Parda")
  console.log('Opening Route Stop Modal...');
  const addStopBtn = page.locator('button:has-text("Add Route Stop / Border")').first();
  await addStopBtn.click();
  await page.waitForTimeout(1000);

  const shot1aModalAdd = path.join(ARTIFACT_DIR, '12a_step1a_route_stop_modal_add.png');
  await page.screenshot({ path: shot1aModalAdd });
  console.log('Saved 12a_step1a_route_stop_modal_add.png');

  // Fill in Route Stop details
  console.log('Filling in transit waypoint details...');
  const modal = page.locator('div[role="dialog"]');
  const countrySelect = modal.locator('select').first();
  const optCount = await countrySelect.locator('option').count();
  if (optCount > 1) {
    await countrySelect.selectOption({ index: 1 });
  }

  const locationInput = modal.locator('input[type="text"]').first();
  await locationInput.fill('Bandar Abbas Transit Port');

  const terminalInput = modal.locator('input[type="text"]').nth(1);
  await terminalInput.fill('Customs Yard Gate 4');

  // Check insurance
  const insCheckbox = modal.locator('input[type="checkbox"]');
  await insCheckbox.check();

  // Click Apply & Add Stop
  const applyBtn = modal.locator('button:has-text("Apply & Add Stop")');
  await applyBtn.click();
  await page.waitForTimeout(1000);

  // 3. Capture Step 1A after adding stop
  await corridorHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  const shot1aAfterAdd = path.join(ARTIFACT_DIR, '12b_step1a_after_adding_stop.png');
  await page.screenshot({ path: shot1aAfterAdd });
  console.log('Saved 12b_step1a_after_adding_stop.png');

  // 4. Click Edit Details on the newly added stop
  console.log('Clicking Edit Details on stop card...');
  const editDetailsBtn = page.locator('button:has-text("Edit Details")').first();
  await editDetailsBtn.click();
  await page.waitForTimeout(1000);

  const shot1aModalEdit = path.join(ARTIFACT_DIR, '12c_step1a_route_stop_modal_edit.png');
  await page.screenshot({ path: shot1aModalEdit });
  console.log('Saved 12c_step1a_route_stop_modal_edit.png');

  // Close modal
  await page.locator('div[role="dialog"] button[aria-label="Close"]').click();
  await page.waitForTimeout(1000);

  // 5. SWITCH TO STEP 1B (TRUCK & TRANSPORT)
  console.log('Switching to Step 1B (Truck & Transport)...');
  await page.locator('button:has-text("1B — Truck & Transport")').first().click();
  await page.waitForTimeout(1500);

  // Scroll to truck assignment section
  const truckSection = page.locator('label:has-text("Truck Assignment Mode")').first();
  await truckSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const shot1bDropdown = path.join(ARTIFACT_DIR, '13a_step1b_truck_dropdown_view.png');
  await page.screenshot({ path: shot1bDropdown });
  console.log('Saved 13a_step1b_truck_dropdown_view.png');

  // Test selecting "Assign Later"
  console.log('Selecting Assign Later...');
  const modeSelect = page.locator('select:has(option[value="permanent"])').first();
  await modeSelect.selectOption('later');
  await page.waitForTimeout(1000);

  const shot1bLater = path.join(ARTIFACT_DIR, '13b_step1b_assign_later_badge.png');
  await page.screenshot({ path: shot1bLater });
  console.log('Saved 13b_step1b_assign_later_badge.png');

  // Test selecting "Permanent Truck" and opening Fleet Master picker
  console.log('Selecting Permanent Truck...');
  await modeSelect.selectOption('permanent');
  await page.waitForTimeout(1000);

  // Click Browse Fleet Master
  const browseFleetBtn = page.locator('button:has-text("Browse Fleet Master")').first();
  if (await browseFleetBtn.count() > 0) {
    await browseFleetBtn.click();
    await page.waitForTimeout(1500);

    const shot1bFleetModal = path.join(ARTIFACT_DIR, '13c_step1b_fleet_picker_modal.png');
    await page.screenshot({ path: shot1bFleetModal });
    console.log('Saved 13c_step1b_fleet_picker_modal.png');

    // Pick first available fleet vehicle or close
    const pickBtn = page.locator('div[role="dialog"] button:has-text("Assign Vehicle")').first();
    if (await pickBtn.count() > 0) {
      await pickBtn.click();
      await page.waitForTimeout(1500);

      // Capture active vehicle confirmation card
      const shot1bAssignedCard = path.join(ARTIFACT_DIR, '13d_step1b_active_vehicle_card.png');
      await page.screenshot({ path: shot1bAssignedCard });
      console.log('Saved 13d_step1b_active_vehicle_card.png');
    }
  }

  await browser.close();
  console.log('All Step 1A & Step 1B visual proofs captured successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
