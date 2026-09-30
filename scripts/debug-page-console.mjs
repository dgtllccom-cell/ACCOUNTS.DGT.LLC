import { chromium } from '@playwright/test';
import { createHmac } from 'node:crypto';

const TARGET_HOST = 'http://localhost:3000';
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR]`, err.message));
  page.on('requestfailed', req => console.log(`[FAILED REQ]`, req.url(), req.failure()?.errorText));

  const targetUrl = `${TARGET_HOST}/dashboard/clearing-agent/customer-order`;
  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(6000);

  // Click Refresh button if present
  const refreshBtn = page.locator('button:has-text("Refresh")').first();
  if (await refreshBtn.isVisible()) {
    console.log('Clicking Refresh button...');
    await refreshBtn.click();
    await page.waitForTimeout(4000);
  }

  await browser.close();
}

run().catch(console.error);
