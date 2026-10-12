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
  console.log('Starting visual capture of Warehouse Selection Modal & Step 1C upgrade...');
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Switch to Step 1C Goods Entry
  console.log('Switching to Step 1C...');
  await page.locator('button:has-text("1C — Goods Entry")').first().click();
  await page.waitForTimeout(1500);

  // 1. Capture Step 1C with the clean Warehouse trigger card
  const shot1 = path.join(ARTIFACT_DIR, '08_step1c_warehouse_trigger_card.png');
  await page.screenshot({ path: shot1 });
  console.log('Saved 08_step1c_warehouse_trigger_card.png');

  // 2. Click the Warehouse Trigger Card to open the modal ("parda")
  console.log('Clicking Warehouse Trigger Card to open modal...');
  await page.getByRole('button', { name: /Choose Warehouse|Change/i }).first().click();
  await page.waitForTimeout(1000);

  // 2a. Capture Tab 1: Company Warehouse
  const shotCompany = path.join(ARTIFACT_DIR, '09a_warehouse_modal_company.png');
  await page.screenshot({ path: shotCompany });
  console.log('Saved 09a_warehouse_modal_company.png');

  // 2b. Switch to Tab 2: Customer Warehouse
  console.log('Switching to Customer Warehouse tab...');
  await page.locator('button:has-text("Customer Warehouse")').first().click();
  await page.waitForTimeout(800);
  const shotCustomer = path.join(ARTIFACT_DIR, '09b_warehouse_modal_customer.png');
  await page.screenshot({ path: shotCustomer });
  console.log('Saved 09b_warehouse_modal_customer.png');

  // 2c. Switch to Tab 3: Other Warehouse
  console.log('Switching to Other Warehouse tab...');
  await page.locator('button:has-text("Other / 3rd-Party")').first().click();
  await page.waitForTimeout(800);
  const shotOther = path.join(ARTIFACT_DIR, '09c_warehouse_modal_other.png');
  await page.screenshot({ path: shotOther });
  console.log('Saved 09c_warehouse_modal_other.png');

  // Fill in other warehouse details and apply
  console.log('Filling other warehouse details...');
  await page.locator('input[placeholder*="Al-Falah Logistics"]').fill('Al-Falah Logistics Yard, Gate 4');
  await page.locator('input[placeholder*="Plot No, Street"]').fill('Berth 5, Port Qasim Container Terminal, Karachi');
  await page.locator('input[placeholder*="Tariq Khan"]').fill('Tariq Khan (Terminal Superintendent)');
  await page.locator('input[placeholder*="+971 50"]').fill('+92 300 1234567');
  await page.waitForTimeout(500);

  // Click "Apply Warehouse Location"
  console.log('Applying warehouse...');
  await page.locator('button:has-text("Apply Warehouse Location")').click();
  await page.waitForTimeout(1000);

  // 3. Capture Step 1C after applying warehouse
  const shotUpdated = path.join(ARTIFACT_DIR, '10_step1c_after_warehouse_selection.png');
  await page.screenshot({ path: shotUpdated });
  console.log('Saved 10_step1c_after_warehouse_selection.png');

  await browser.close();
  console.log('🎉 ALL WAREHOUSE MODAL PROOFS CAPTURED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Error during warehouse capture:', err);
  process.exit(1);
});
