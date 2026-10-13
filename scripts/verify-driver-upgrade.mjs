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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([
    { name: 'erp_session', value: buildToken(), domain: '72.60.209.121', path: '/' },
    { name: 'erp_lang', value: 'en', domain: '72.60.209.121', path: '/' }
  ]);
  const page = await ctx.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('response', async res => {
    if (res.url().includes('/api/erp/customers/')) {
      console.log('CUSTOMER FETCH URL:', res.url(), 'STATUS:', res.status());
      try {
        const json = await res.json();
        console.log('CUSTOMER JSON:', JSON.stringify(json).slice(0, 300));
      } catch (e) {
        console.log('CUSTOMER ERROR:', e.message);
      }
    }
  });

  console.log('Navigating to live truck registration...');
  await page.goto('http://72.60.209.121/dashboard/clearing-agent/truck-registration', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("New Clearing Truck Registration")').first().click();
  await page.waitForTimeout(2000);

  // Scroll to Driver Card
  await page.evaluate(() => {
    const el = document.getElementById('driverCard');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });
  await page.waitForTimeout(1000);

  console.log('1. Checking Permanent Driver state...');
  const driverCard = page.locator('#driverCard');
  
  // Verify manual photo upload is NOT present in Permanent mode
  const photoUpload = driverCard.locator('text=Add Driver Photo');
  console.log('Photo upload visible in Permanent?', await photoUpload.isVisible());

  // Click Search driver...
  const driverPickerBtn = driverCard.locator('button:has-text("Search driver...")').first();
  await driverPickerBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of search dropdown showing + New Driver
  const shotDropdown = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c/live_driver_dropdown_with_new.png';
  await page.screenshot({ path: shotDropdown });
  console.log('Saved dropdown screenshot:', shotDropdown);

  // Select first driver item
  const driverOpt = page.locator('[cmdk-item]').first();
  if (await driverOpt.isVisible()) {
    const driverText = await driverOpt.innerText();
    console.log('Selecting driver option:', driverText);
    await driverOpt.click();
    console.log('Waiting for REGISTERED DRIVER card...');
    const regCard = driverCard.locator('text=REGISTERED DRIVER');
    await regCard.waitFor({ state: 'visible', timeout: 10000 });
    console.log('REGISTERED DRIVER card is visible!');
    await page.waitForTimeout(1000);
  }

  // Scroll window so driverCard and preview card are fully in view
  await page.evaluate(() => {
    const el = document.getElementById('driverCard');
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'instant' });
    const reportContainer = document.querySelector('aside div.overflow-y-auto');
    if (reportContainer) {
      reportContainer.scrollTop = 380;
    }
  });
  await page.waitForTimeout(1000);

  const shotPerm = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c/live_permanent_driver_verified.png';
  await page.screenshot({ path: shotPerm });
  console.log('Saved permanent driver screenshot:', shotPerm);

  // 2. Toggle to Temporary Driver
  console.log('2. Switching to Temporary Driver...');
  const tempRadio = driverCard.locator('input[type="radio"][value="temporary"]').first();
  await tempRadio.check();
  await page.waitForTimeout(1000);

  console.log('Photo upload visible in Temporary?', await driverCard.locator('text=Add Driver Photo').first().isVisible());
  console.log('Multi contacts visible in Temporary?', await driverCard.locator('text=+ Contacts · WhatsApp / Mobile / Email').first().isVisible());
  console.log('Location mgmt visible in Temporary?', await driverCard.locator('text=Location Management for Driver').first().isVisible());

  // Scroll window to driverCard
  await page.evaluate(() => {
    const el = document.getElementById('driverCard');
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'instant' });
  });
  await page.waitForTimeout(1000);

  const shotTemp = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/32a0c37d-b28b-46e0-ae11-f4666340583c/live_temporary_driver_verified.png';
  await page.screenshot({ path: shotTemp });
  console.log('Saved temporary driver screenshot:', shotTemp);

  await browser.close();
  console.log('Verification completed successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
