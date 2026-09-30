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
  console.log('Testing page load with domcontentloaded...');
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: 'localhost', path: '/' },
    { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('React DevTools')) {
      console.log(`[CONSOLE]`, text);
    }
  });

  const targetUrl = `${TARGET_HOST}/dashboard/clearing-agent/customer-order`;
  
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Page DOM content loaded. Waiting 12 seconds for initial fetches...');
  await page.waitForTimeout(12000);

  // Take screenshot of current view
  const listPath = path.join(ARTIFACT_DIR, 'customer_orders_warmed.png');
  await page.screenshot({ path: listPath, fullPage: false });
  console.log('Saved screenshot to:', listPath);

  // Check table row count
  const rowCount = await page.locator('table tbody tr').count();
  console.log('Table row count:', rowCount);

  // Inspect page text for order counts
  const pageText = await page.locator('main, #root, body').first().innerText();
  const match = pageText.match(/(\d+)\s+Orders/i);
  console.log('Orders badge match:', match ? match[0] : 'not found');

  await browser.close();
}

run().catch(console.error);
