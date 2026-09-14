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

async function debugDashboard() {
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

  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
  page.on('requestfailed', req => console.log(`[REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`));

  try {
    console.log(`Navigating to ${BASE_URL}/dashboard ...`);
    const resp = await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 35000 });
    console.log(`Response status: ${resp?.status()}`);
    await page.waitForTimeout(3000);

    const shotPath = path.join(ARTIFACTS_DIR, 'debug_vps_dashboard.png');
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot to: ${shotPath}`);

    const content = await page.content();
    console.log(`Includes 'Module Temporary Exception': ${content.includes('Module Temporary Exception')}`);
    console.log(`Includes 'Loading chunk': ${content.includes('Loading chunk')}`);

    // If there's an exception card, print its text
    const errorText = await page.evaluate(() => {
      const el = document.querySelector('.bg-rose-50, .border-rose-200, code');
      return el ? el.innerText : null;
    });
    console.log(`Error card text: ${errorText}`);

  } finally {
    await browser.close();
  }
}

debugDashboard().catch(console.error);
