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
  console.log('Starting visual capture of Movement & Route Specifications upgrade...');
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  console.log('Waiting for initial lookup endpoints to load...');
  await page.waitForTimeout(14000);

  // Scroll helper
  const scrollToSpecs = async () => {
    const card = page.locator('div.rounded-2xl:has-text("SPECIFICATIONS"), div.rounded-2xl:has-text("RE-EXPORT"), div.rounded-2xl:has-text("TRANSIT")').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  };

  // 1. Capture Standard Import View (with Customs Required: Yes)
  await scrollToSpecs();
  const shot1a = path.join(ARTIFACT_DIR, '15a_import_movement_specs.png');
  await page.screenshot({ path: shot1a });
  console.log('Saved 15a_import_movement_specs.png');

  // 2. Click "No — Direct / Exempt" for Customs Clearance
  console.log('Testing Customs Clearance toggle to No...');
  const customsNoBtn = page.locator('button:has-text("No — Direct / Exempt")').first();
  await customsNoBtn.click();
  await page.waitForTimeout(800);

  const shot1b = path.join(ARTIFACT_DIR, '15b_import_customs_no.png');
  await page.screenshot({ path: shot1b });
  console.log('Saved 15b_import_customs_no.png');

  // Toggle back to Yes
  const customsYesBtn = page.locator('button:has-text("Yes — Required")').first();
  await customsYesBtn.click();
  await page.waitForTimeout(500);

  // 3. Switch to Re-Export using Operation Type modal
  console.log('Switching to Re-Export operation...');
  const opTypeBtn = page.locator('button:has-text("Choose Operation Type")').first();
  await opTypeBtn.click();
  await page.waitForTimeout(800);

  // Click Re-Export card in the dialog
  const reExportCard = page.locator('div[role="dialog"] div:has-text("Re-Export"), div[role="dialog"] button:has-text("Re-Export")').last();
  await reExportCard.click();
  await page.waitForTimeout(1500);

  await scrollToSpecs();
  const shot1c = path.join(ARTIFACT_DIR, '15c_reexport_movement_specs.png');
  await page.screenshot({ path: shot1c });
  console.log('Saved 15c_reexport_movement_specs.png');

  // 4. Switch to Transit
  console.log('Switching to Transit operation...');
  await opTypeBtn.click();
  await page.waitForTimeout(800);

  const transitCard = page.locator('div[role="dialog"] div:has-text("Transit"), div[role="dialog"] button:has-text("Transit")').last();
  await transitCard.click();
  await page.waitForTimeout(1500);

  await scrollToSpecs();
  const shot1d = path.join(ARTIFACT_DIR, '15d_transit_movement_specs.png');
  await page.screenshot({ path: shot1d });
  console.log('Saved 15d_transit_movement_specs.png');

  // 5. Switch to Standard Export using Movement Modal
  console.log('Switching to Standard Export...');
  const movTypeBtn = page.locator('button:has-text("Choose Movement Type")').first();
  await movTypeBtn.click();
  await page.waitForTimeout(800);

  const exportChoice = page.locator('div[role="dialog"] div:has-text("Export"), div[role="dialog"] button:has-text("Export")').last();
  await exportChoice.click();
  await page.waitForTimeout(1500);

  await scrollToSpecs();
  const shot1e = path.join(ARTIFACT_DIR, '15e_export_movement_specs.png');
  await page.screenshot({ path: shot1e });
  console.log('Saved 15e_export_movement_specs.png');

  // 6. Test Urdu RTL view
  console.log('Switching to Urdu for RTL parity check...');
  await context.addCookies([
    { name: 'erp_lang', value: 'ur', domain: 'localhost', path: '/' }
  ]);
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  const urCard = page.locator('div.rounded-2xl:has-text("تفصیلات"), div.rounded-2xl:has-text("امپورٹ")').first();
  if (await urCard.count() > 0) {
    await urCard.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(1000);

  const shot1f = path.join(ARTIFACT_DIR, '15f_ur_rtl_movement_specs.png');
  await page.screenshot({ path: shot1f });
  console.log('Saved 15f_ur_rtl_movement_specs.png');

  await browser.close();
  console.log('🎉 ALL MOVEMENT SPECIFICATIONS PROOFS CAPTURED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
