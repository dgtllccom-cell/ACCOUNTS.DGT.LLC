import { chromium } from '@playwright/test';
import path from 'path';
import { createHmac } from 'node:crypto';

const TARGET_HOST = 'http://72.60.209.121';
const ARTIFACT_DIR = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\aa92dc33-27bb-443c-9399-16f2bda11bde';
const SESSION_SECRET = 'add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f';

function buildSessionToken() {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"],
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
  console.log('Launching browser to capture VPS at:', TARGET_HOST);
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: '72.60.209.121', path: '/' },
    { name: 'erp_lang', value: 'en', domain: '72.60.209.121', path: '/' }
  ]);

  const page = await context.newPage();
  const targetUrl = `${TARGET_HOST}/dashboard/new-entry/accounts/general-report`;
  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const fullPath = path.join(ARTIFACT_DIR, 'general_report_full_view.png');
  await page.screenshot({ path: fullPath, fullPage: false });
  console.log('Full page screenshot saved to:', fullPath);

  // Capture cards container
  const cards = page.locator('.summary-cards-container');
  if (await cards.isVisible()) {
    const cardsPath = path.join(ARTIFACT_DIR, 'general_report_summary_cards.png');
    await cards.screenshot({ path: cardsPath });
    console.log('Cards screenshot saved to:', cardsPath);
  }

  // Click report view dropdown to show menu open
  const dropdownTrigger = page.locator('button:has-text("SUPER ADMIN REPORTS"), button:has-text("USER & BRANCH REPORTS")').first();
  if (await dropdownTrigger.isVisible()) {
    await dropdownTrigger.click();
    await page.waitForTimeout(600);
    const dropdownPath = path.join(ARTIFACT_DIR, 'general_report_dropdown_open.png');
    await page.screenshot({ path: dropdownPath, fullPage: false });
    console.log('Dropdown open screenshot saved to:', dropdownPath);
  }

  await browser.close();
  console.log('Capture completed successfully!');
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
