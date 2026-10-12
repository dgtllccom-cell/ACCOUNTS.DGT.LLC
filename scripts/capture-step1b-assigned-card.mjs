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
  console.log('Capturing assigned external truck confirmation card...');
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

  // Select Other / External Truck
  const modeSelect = page.locator('select:has(option[value="permanent"])').first();
  await modeSelect.selectOption('hired');
  await page.waitForTimeout(1000);

  // Pick recently used external truck radio button
  const radio = page.locator('input[type="radio"]').first();
  await radio.check();
  await page.waitForTimeout(500);

  // Click Save & Apply Truck
  const saveBtn = page.locator('button:has-text("Save & Apply Truck")');
  await saveBtn.click();
  await page.waitForTimeout(1500);

  // Capture Step 1B with active vehicle confirmation card
  const truckSection = page.locator('label:has-text("Truck Assignment Mode")').first();
  await truckSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const shotAssignedCard = path.join(ARTIFACT_DIR, '13e_step1b_assigned_truck_card.png');
  await page.screenshot({ path: shotAssignedCard });
  console.log('Saved 13e_step1b_assigned_truck_card.png');

  await browser.close();
  console.log('Assigned external truck card captured successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
