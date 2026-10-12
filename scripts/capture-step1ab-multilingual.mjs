import { chromium } from '@playwright/test';
import { createHmac } from 'node:crypto';
import path from 'path';

const TARGET_HOST = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\32a0c37d-b28b-46e0-ae11-f4666340583c';
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

async function captureLang(lang, suffix) {
  console.log(`Capturing ${lang.toUpperCase()} RTL proofs...`);
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: lang, domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order?create=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(14000);

  // 1. Capture Route Stop Modal in this language
  const addStopBtn = page.locator('button:has-text("Add Route Stop"), button:has-text("اسٹاپ"), button:has-text("إضافة")').first();
  if (await addStopBtn.count() > 0) {
    await addStopBtn.click();
    await page.waitForTimeout(1000);

    const shotModal = path.join(ARTIFACT_DIR, `14_${suffix}_route_stop_modal.png`);
    await page.screenshot({ path: shotModal });
    console.log(`Saved 14_${suffix}_route_stop_modal.png`);

    // Close modal
    await page.locator('div[role="dialog"] button[aria-label="Close"], div[role="dialog"] button:has-text("Cancel"), div[role="dialog"] button:has-text("منسوخ"), div[role="dialog"] button:has-text("إلغاء")').first().click();
    await page.waitForTimeout(1000);
  }

  // 2. Switch to 1B
  const tab1b = page.locator('button:has-text("1B")').first();
  if (await tab1b.count() > 0) {
    await tab1b.click();
    await page.waitForTimeout(1500);

    const shot1b = path.join(ARTIFACT_DIR, `15_${suffix}_step1b_truck.png`);
    await page.screenshot({ path: shot1b });
    console.log(`Saved 15_${suffix}_step1b_truck.png`);
  }

  await browser.close();
}

async function run() {
  await captureLang('ar', 'ar_rtl');
  await captureLang('ur', 'ur_rtl');
  console.log('Multilingual RTL proofs completed!');
}

run().catch(err => {
  console.error('Multilingual capture error:', err);
  process.exit(1);
});
