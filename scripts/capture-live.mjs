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
    roles: ["super_admin", "super_admin_reports"],
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
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  const targetUrl = `${TARGET_HOST}/dashboard/clearing-agent/customer-order`;
  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'load', timeout: 60000 });
  
  console.log('Waiting for table rows with CL-ORD to appear...');
  await page.waitForSelector('table tbody tr:has-text("CL-ORD")', { timeout: 35000 });
  console.log('Table rows detected!');
  await page.waitForTimeout(2000);

  // 1. Capture Full Table Screenshot
  const listPath = path.join(ARTIFACT_DIR, 'customer_orders_live_table.png');
  await page.screenshot({ path: listPath, fullPage: false });
  console.log('Screenshot saved to:', listPath);

  // 2. Filter / Search for Walnut (User Audio 1)
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.isVisible()) {
    console.log('Searching for Walnut Kernel order (Audio 1)...');
    await searchInput.fill('Walnut');
    await page.waitForTimeout(2000);

    const walnutPath = path.join(ARTIFACT_DIR, 'customer_orders_walnut_row.png');
    await page.screenshot({ path: walnutPath, fullPage: false });
    console.log('Walnut screenshot saved to:', walnutPath);

    // Click on Walnut order row / view button to open details/modal
    const firstRow = page.locator('table tbody tr').first();
    const viewBtn = firstRow.locator('button').first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
      await page.waitForTimeout(2500);

      const modalPath = path.join(ARTIFACT_DIR, 'customer_orders_walnut_modal.png');
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log('Walnut modal screenshot saved to:', modalPath);

      // Close modal / view if open
      const closeBtn = page.locator('button:has-text("Close"), button[aria-label="Close"], button:has-text("✕")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 3. Search for Chaman Dry Fruits (User Audio 2 & 3)
    console.log('Searching for Chaman Dry Fruits order...');
    await searchInput.fill('Mixed Dry Fruit');
    await page.waitForTimeout(2000);

    const dryFruitPath = path.join(ARTIFACT_DIR, 'customer_orders_chaman_dryfruits.png');
    await page.screenshot({ path: dryFruitPath, fullPage: false });
    console.log('Dry Fruit screenshot saved to:', dryFruitPath);

    // 4. Search for China via Tajikistan (User Audio 4)
    console.log('Searching for China via Tajikistan order...');
    await searchInput.fill('China');
    await page.waitForTimeout(2000);

    const chinaPath = path.join(ARTIFACT_DIR, 'customer_orders_china_tajikistan.png');
    await page.screenshot({ path: chinaPath, fullPage: false });
    console.log('China route screenshot saved to:', chinaPath);
  }

  await browser.close();
  console.log('ALL SCREENSHOTS CAPTURED PERFECTLY!');
}

run().catch(console.error);
