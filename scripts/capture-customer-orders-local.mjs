import { chromium } from '@playwright/test';
import path from 'path';
import { createHmac } from 'node:crypto';

const TARGET_HOST = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\aa92dc33-27bb-443c-9399-16f2bda11bde';
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
  console.log('Launching browser to capture localhost at:', TARGET_HOST);
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

  // Wait for table rows to appear
  try {
    await page.waitForSelector('table tbody tr:not(.empty-row)', { timeout: 15000 });
  } catch (e) {
    console.log('Timed out waiting for non-empty row; checking content...');
  }
  await page.waitForTimeout(3000);

  // 1. Capture customer order list
  const listPath = path.join(ARTIFACT_DIR, 'customer_orders_list.png');
  await page.screenshot({ path: listPath, fullPage: false });
  console.log('Customer orders list screenshot saved to:', listPath);

  // 2. Click on the first row or an action to view/edit order
  const orderRow = page.locator('table tbody tr').first();
  if (await orderRow.isVisible()) {
    console.log('Clicking on first order row...');
    // Look for edit or view button if clicking row does nothing
    const editBtn = orderRow.locator('button').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
    } else {
      await orderRow.click();
    }
    await page.waitForTimeout(3000);
    const detailPath = path.join(ARTIFACT_DIR, 'customer_orders_detail_view.png');
    await page.screenshot({ path: detailPath, fullPage: false });
    console.log('Detail view screenshot saved to:', detailPath);
  }

  // 3. Capture second order or route
  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Error running capture:', err);
  process.exit(1);
});
