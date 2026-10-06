import { chromium } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

const ARTIFACTS_DIR = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/107b6097-6ab0-45d4-b9a8-c3069323c262';
const BASE_URL = 'http://72.60.209.121';
const SECRET = 'add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f';

function createSuperAdminCookie() {
  const payload = {
    v: 1,
    kind: 'temp',
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'superadmin@damaan.com',
    fullName: 'Super Admin (Global Group)',
    roles: ['super_admin'],
    createdAt: Date.now()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

const TARGET_PAGES = [
  { name: '1_temp_bills_purchase', path: '/dashboard/temp-bills/purchase', label: 'Temporary Purchase Bills' },
  { name: '2_temp_bills_sales', path: '/dashboard/temp-bills/sales', label: 'Temporary Sales Bills' },
  { name: '3_purchase_booking', path: '/dashboard/purchase/new-purchase-booking-order', label: 'New Purchase Booking Order' },
  { name: '4_purchase_country_transfer', path: '/dashboard/purchase/country-transfer', label: 'Purchase Country Transfer' },
  { name: '5_purchase_local', path: '/dashboard/purchase/local-purchase', label: 'Local Purchase' },
  { name: '6_sales_booking', path: '/dashboard/sales/new-sales-booking-order', label: 'New Sales Booking Order' },
  { name: '7_sales_local', path: '/dashboard/sales/local-sales', label: 'Local Sales' },
  { name: '8_shipping_customer_order', path: '/dashboard/clearing-agent/customer-order', label: 'Customer Order / Booking' },
  { name: '9_settings_companies', path: '/dashboard/settings/companies', label: 'Settings Companies Setup' },
  { name: '10_accounts_registry', path: '/dashboard/settings/accounts', label: 'Account Master Registry' }
];

async function verifyAllPages() {
  console.log('=======================================================================');
  console.log(`  VERIFYING ALL REQUESTED PAGES ON VPS (${BASE_URL})`);
  console.log('=======================================================================\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    try {
      browser = await chromium.launch({ headless: true, channel: 'msedge' });
    } catch {
      browser = await chromium.launch({ headless: true });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const sessionToken = createSuperAdminCookie();
  await context.addCookies([
    { name: 'erp_session', value: sessionToken, domain: '72.60.209.121', path: '/' },
    { name: 'erp_lang', value: 'en', domain: '72.60.209.121', path: '/' }
  ]);

  const page = await context.newPage();
  const results = [];

  try {
    for (const target of TARGET_PAGES) {
      const url = `${BASE_URL}${target.path}`;
      console.log(`[TESTING] ${target.label} (${url}) ...`);
      
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(2000);

        // Check if an actual error boundary card is rendered on the screen
        const errorCard = await page.evaluate(() => {
          const headings = Array.from(document.querySelectorAll('h2, h3, h4, strong, p'));
          const errorHeading = headings.find(h => h.textContent?.includes('Module Temporary Exception') || h.textContent?.includes('Loading chunk failed'));
          if (errorHeading) {
            const codeEl = document.querySelector('code');
            return codeEl ? codeEl.innerText : errorHeading.textContent;
          }
          return null;
        });

        const screenshotName = `vps_${target.name}.png`;
        const screenshotPath = path.join(ARTIFACTS_DIR, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        if (errorCard) {
          console.log(`   ❌ FAILED: Exception card rendered: ${errorCard}`);
          results.push({ ...target, status: 'FAILED', error: errorCard, screenshot: screenshotName });
        } else if (resp?.status() >= 400) {
          console.log(`   ❌ FAILED: HTTP Status ${resp?.status()}`);
          results.push({ ...target, status: 'FAILED', error: `HTTP ${resp?.status()}`, screenshot: screenshotName });
        } else {
          console.log(`   ✅ PASSED: Loaded cleanly (HTTP ${resp?.status()}). Screenshot: ${screenshotName}`);
          results.push({ ...target, status: 'PASSED', error: null, screenshot: screenshotName });
        }
      } catch (err) {
        console.log(`   ❌ ERROR: ${err.message}`);
        const screenshotName = `vps_${target.name}_err.png`;
        const screenshotPath = path.join(ARTIFACTS_DIR, screenshotName);
        try {
          await page.screenshot({ path: screenshotPath, fullPage: false });
        } catch {}
        results.push({ ...target, status: 'ERROR', error: err.message, screenshot: screenshotName });
      }
    }

  } finally {
    await browser.close();
  }

  console.log('\n=======================================================================');
  console.log('  FINAL VERIFICATION RESULTS TABLE (VPS: 72.60.209.121)');
  console.log('=======================================================================');
  console.table(results.map(r => ({
    Label: r.label,
    Path: r.path,
    Status: r.status,
    Error: r.error || 'None',
    Screenshot: r.screenshot
  })));

  const allPassed = results.every(r => r.status === 'PASSED');
  console.log(`\nOVERALL VERIFICATION: ${allPassed ? 'ALL PAGES PASSED ✅' : 'SOME PAGES FAILED ❌'}`);
  process.exit(allPassed ? 0 : 1);
}

verifyAllPages().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
