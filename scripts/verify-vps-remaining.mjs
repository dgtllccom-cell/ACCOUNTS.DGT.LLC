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

const PAGES_TO_VERIFY = [
  { name: '5_purchase_local', path: '/dashboard/purchase/local-purchase', label: 'Local Purchase' },
  { name: '8_shipping_customer_order', path: '/dashboard/clearing-agent/customer-order', label: 'Customer Order / Booking' }
];

async function verifyRemaining() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const token = createSuperAdminCookie();
  await context.addCookies([
    { name: 'erp_session', value: token, domain: '72.60.209.121', path: '/' },
    { name: 'erp_lang', value: 'en', domain: '72.60.209.121', path: '/' }
  ]);

  const page = await context.newPage();

  for (const target of PAGES_TO_VERIFY) {
    const url = `${BASE_URL}${target.path}`;
    console.log(`[TESTING] ${target.label} (${url}) ...`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    const errorCard = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2, h3, h4, strong, p'));
      const errorHeading = headings.find(h => h.textContent?.includes('Module Temporary Exception') || h.textContent?.includes('Loading chunk failed'));
      return errorHeading ? errorHeading.textContent : null;
    });

    const screenshotName = `vps_${target.name}.png`;
    const screenshotPath = path.join(ARTIFACTS_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    if (errorCard) {
      console.log(`   ❌ FAILED: ${errorCard}`);
    } else {
      console.log(`   ✅ PASSED: Loaded cleanly (HTTP ${resp?.status()}). Screenshot: ${screenshotName}`);
    }
  }

  await browser.close();
}

verifyRemaining().catch(console.error);
