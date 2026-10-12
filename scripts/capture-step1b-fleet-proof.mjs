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
  console.log('Capturing Fleet Picker modal and assigned truck confirmation card...');
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(14000);

  // Switch to 1B
  await page.locator('button:has-text("1B — Truck & Transport")').first().click();
  await page.waitForTimeout(1500);

  // Click Browse Fleet Master
  const browseFleetBtn = page.locator('button:has-text("Browse Fleet Master")').first();
  await browseFleetBtn.click();
  await page.waitForTimeout(1500);

  const shotFleetModal = path.join(ARTIFACT_DIR, '13c_step1b_fleet_picker_modal.png');
  await page.screenshot({ path: shotFleetModal });
  console.log('Saved 13c_step1b_fleet_picker_modal.png');

  // Select the first vehicle in the table
  const selectVehicleBtn = page.locator('div[role="dialog"] button:has-text("Select"), div[role="dialog"] button:has-text("Assign")').first();
  if (await selectVehicleBtn.count() > 0) {
    await selectVehicleBtn.click();
  } else {
    // Click any row in table
    const firstRow = page.locator('div[role="dialog"] table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
    }
  }
  await page.waitForTimeout(1500);

  // Capture Step 1B with the assigned vehicle confirmation card
  const truckSection = page.locator('label:has-text("Truck Assignment Mode")').first();
  await truckSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const shotAssigned = path.join(ARTIFACT_DIR, '13d_step1b_active_vehicle_card.png');
  await page.screenshot({ path: shotAssigned });
  console.log('Saved 13d_step1b_active_vehicle_card.png');

  await browser.close();
  console.log('Fleet picker and active vehicle card captured successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
