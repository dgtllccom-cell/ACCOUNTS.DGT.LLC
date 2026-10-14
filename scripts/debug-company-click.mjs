import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

const SESSION_SECRET = 'add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f';
function buildToken() {
  const p = { v: 1, kind: 'temp', userId: 'be3a6b15-65c5-4d74-82ae-e956c02a5f07', email: 'superadmin@dgt.llc', fullName: 'Super Admin', roles: ['super_admin'], isSuperAdmin: true, assignments: [{ role: 'super_admin', countryId: null, countryBranchId: null, cityBranchId: null, operationalDomain: 'both', mobileProfile: 'standard' }], createdAt: Date.now() };
  const b64 = Buffer.from(JSON.stringify(p)).toString('base64url');
  return b64 + '.' + createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addCookies([
    { name: 'erp_session', value: buildToken(), domain: '72.60.209.121', path: '/' },
    { name: 'erp_lang', value: 'en', domain: '72.60.209.121', path: '/' }
  ]);
  const page = await ctx.newPage();
  page.on('response', async res => {
    if (res.url().includes('/api/erp/companies')) {
      console.log('COMPANY URL:', res.url(), 'STATUS:', res.status());
      try {
        const text = await res.text();
        console.log('RESPONSE PREVIEW:', text.slice(0, 150));
      } catch(e) {}
    }
  });
  await page.goto('http://72.60.209.121/dashboard/clearing-agent/truck-registration', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("New Clearing Truck Registration")').first().click();
  await page.waitForTimeout(2000);
  
  const compBtn = page.locator('button:has-text("Search company...")').first();
  await compBtn.click();
  await page.waitForTimeout(1000);
  
  const opt = page.locator('[cmdk-item]').filter({ hasText: 'import expotr' }).first();
  console.log('Found opt?', await opt.count());
  await opt.click();
  await page.waitForTimeout(3000);

  console.log('Waiting for company details card to appear...');
  const compCard = page.locator('#transporterCard').locator('text=REGISTERED COMPANY');
  await compCard.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Company Card visible in Form!');

  // Scroll the sticky live report container to show Section 3 in full view
  await page.evaluate(() => {
    const reportContainer = document.querySelector('aside div.overflow-y-auto');
    if (reportContainer) {
      reportContainer.scrollTop = 260;
    }
  });
  await page.waitForTimeout(1000);

  const shot = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c/live_company_selected_verified.png';
  await page.screenshot({ path: shot, fullPage: false });
  console.log('Saved verified screenshot to:', shot);

  await browser.close();
}

run().catch(console.error);
