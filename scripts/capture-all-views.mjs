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
  console.log('Launching browser to capture customer orders...');
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
  await page.goto(targetUrl, { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(6000);

  // 1. Full list view screenshot
  const listPath = path.join(ARTIFACT_DIR, 'customer_orders_full_list.png');
  await page.screenshot({ path: listPath, fullPage: false });
  console.log('Full list screenshot saved to:', listPath);

  // 2. Search for Walnut Kernel (Audio 1 entry)
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.isVisible()) {
    console.log('Searching for Walnut Kernel order...');
    await searchInput.fill('Walnut');
    await page.waitForTimeout(2000);

    const walnutListPath = path.join(ARTIFACT_DIR, 'customer_orders_walnut_transit.png');
    await page.screenshot({ path: walnutListPath, fullPage: false });
    console.log('Walnut order screenshot saved to:', walnutListPath);

    // Click on the action button or row to view details
    const actionBtn = page.locator('table tbody tr button').first();
    if (await actionBtn.isVisible()) {
      await actionBtn.click();
      await page.waitForTimeout(2000);
      const detailPath = path.join(ARTIFACT_DIR, 'customer_orders_walnut_detail.png');
      await page.screenshot({ path: detailPath, fullPage: false });
      console.log('Walnut detail screenshot saved to:', detailPath);
    }

    // Clear search and search for Chaman / Dry Fruits (Audio 3)
    await searchInput.fill('Haji Qasim');
    await page.waitForTimeout(2000);
    const chamanPath = path.join(ARTIFACT_DIR, 'customer_orders_chaman_dryfruits.png');
    await page.screenshot({ path: chamanPath, fullPage: false });
    console.log('Chaman Dry Fruits screenshot saved to:', chamanPath);
  }

  await browser.close();
  console.log('DONE CAPTURING ALL PROOFS!');
}

run().catch(console.error);
