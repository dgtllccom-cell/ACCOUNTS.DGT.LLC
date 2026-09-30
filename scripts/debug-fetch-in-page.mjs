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
  const context = await browser.newContext();

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/customer-order`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const evalResult = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/erp/clearing-agent/customer-order');
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
      return { status: res.status, parsed };
    } catch (err) {
      return { error: err.message };
    }
  });

  console.log('Eval status:', evalResult.status);
  console.log('Eval data count:', evalResult.parsed?.data?.length);
  console.log('Eval keys:', Object.keys(evalResult.parsed || {}));

  await browser.close();
}

run().catch(console.error);
