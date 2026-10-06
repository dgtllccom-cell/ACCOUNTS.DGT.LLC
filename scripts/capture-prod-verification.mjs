import { chromium } from '@playwright/test';
import path from 'path';
import { createHmac } from 'node:crypto';

const TARGET_HOST = 'http://72.60.209.121';
const ARTIFACT_DIR = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\f2d77d4c-1c68-44b5-8aa3-93ef7b7f056c';
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
  console.log('Launching browser to inspect VPS at:', TARGET_HOST);
  const token = buildSessionToken();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    { name: 'erp_session', value: token, domain: '72.60.209.121', path: '/' },
    { name: 'erp_lang', value: 'en', domain: '72.60.209.121', path: '/' }
  ]);

  const page = await context.newPage();
  page.on('dialog', async d => {
    console.log('BROWSER DIALOG:', d.message());
    await d.accept();
  });

  // 1. Visit Roznamcha Cash Entry (Open Modal)
  console.log('1. Navigating to /dashboard/roznamcha/cash-entry...');
  await page.goto(`${TARGET_HOST}/dashboard/roznamcha/cash-entry`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const newEntryBtn = page.locator('button:has-text("New Entry"), button:has-text("Daily Cash Entry")').first();
  if (await newEntryBtn.isVisible()) {
    console.log('Clicking New Entry button to open Cash Entry modal...');
    await newEntryBtn.click();
    await page.waitForTimeout(3000);
  }

  const cashEntryPath = path.join(ARTIFACT_DIR, 'prod_vps_cash_entry.png');
  await page.screenshot({ path: cashEntryPath, fullPage: false });
  console.log('Captured Roznamcha Cash Entry modal:', cashEntryPath);

  // 2. Visit Roznamcha Journal Report
  console.log('2. Navigating to /dashboard/roznamcha/all...');
  await page.goto(`${TARGET_HOST}/dashboard/roznamcha/all`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const journalPath = path.join(ARTIFACT_DIR, 'prod_vps_journal_report.png');
  await page.screenshot({ path: journalPath, fullPage: false });
  console.log('Captured Roznamcha Journal Report:', journalPath);

  // 3. Visit Local Purchase Registry & Click New Purchase
  console.log('3. Navigating to /dashboard/purchase/local-purchase...');
  await page.goto(`${TARGET_HOST}/dashboard/purchase/local-purchase`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Clicking + New Purchase button...');
  const newPurchaseBtn = page.locator('button:has-text("New Purchase")').first();
  await newPurchaseBtn.click();
  await page.waitForTimeout(2000);

  // If Scope Modal opens, confirm scope
  console.log('Checking for Scope Modal...');
  const confirmScopeBtn = page.locator('button:has-text("Confirm Scope")').first();
  if (await confirmScopeBtn.isVisible()) {
    console.log('Scope modal is visible, selecting first country and branch...');
    // Select first country in scope modal
    const countrySelect = page.locator('select').filter({ hasText: 'Select Country' }).first();
    if (await countrySelect.count() > 0) {
      const opts = await countrySelect.locator('option').all();
      if (opts.length > 1) {
        const val = await opts[1].getAttribute('value');
        if (val) await countrySelect.selectOption(val);
      }
    }
    await page.waitForTimeout(1000);
    console.log('Clicking Confirm Scope...');
    await confirmScopeBtn.click();
    await page.waitForTimeout(3000);
  }

  // Now we are on Step 1: Booking!
  console.log('Capturing Local Purchase Step 1...');
  const step1Path = path.join(ARTIFACT_DIR, 'prod_vps_local_purchase_step1.png');
  await page.screenshot({ path: step1Path, fullPage: false });
  console.log('Captured Local Purchase Step 1:', step1Path);

  // Select Accounts in Step 1
  console.log('Selecting accounts in Step 1...');
  const crSelect = page.locator('select').filter({ hasText: 'Select Credit Account' }).first();
  if (await crSelect.count() > 0) {
    const opts = await crSelect.locator('option').all();
    if (opts.length > 1) {
      const val = await opts[1].getAttribute('value');
      if (val) await crSelect.selectOption(val);
    }
  }

  const drSelect = page.locator('select').filter({ hasText: 'Select Debit Account' }).first();
  if (await drSelect.count() > 0) {
    const opts = await drSelect.locator('option').all();
    if (opts.length > 1) {
      const val = await opts[1].getAttribute('value');
      if (val) await drSelect.selectOption(val);
    }
  }
  await page.waitForTimeout(1000);

  // Advance to Step 2
  console.log('Advancing to Step 2 (Goods Entry)...');
  const nextGoodsBtn = page.locator('button:has-text("Next: Goods Entry")').first();
  if (await nextGoodsBtn.isVisible()) {
    await nextGoodsBtn.click();
  } else {
    await page.locator('button:has-text("2 Goods")').first().click();
  }
  await page.waitForTimeout(3000);

  const step2Path = path.join(ARTIFACT_DIR, 'prod_vps_local_purchase_step2.png');
  await page.screenshot({ path: step2Path, fullPage: false });
  console.log('Captured Local Purchase Step 2:', step2Path);

  // Step 2: Select a product, enter quantity and rate
  console.log('Selecting goods and entering quantity and rate...');
  const goodsSelect = page.locator('select').filter({ hasText: 'Select Goods Master' }).first();
  if (await goodsSelect.count() > 0) {
    const opts = await goodsSelect.locator('option').all();
    if (opts.length > 1) {
      const val = await opts[1].getAttribute('value');
      if (val) await goodsSelect.selectOption(val);
    }
  }

  const qtyInput = page.locator('input[placeholder*="800"], input[placeholder*="Qty"]').first();
  if (await qtyInput.isVisible()) {
    await qtyInput.fill('500');
  }

  const rateInput = page.locator('input[placeholder*="0.00"]').first();
  if (await rateInput.isVisible()) {
    await rateInput.fill('25.5');
  }

  // Click Add Item to List
  const addItemBtn = page.locator('button:has-text("Add Item to List")').first();
  if (await addItemBtn.isVisible()) {
    await addItemBtn.click();
    await page.waitForTimeout(1500);
  }

  // Advance to Step 3
  console.log('Advancing to Step 3 (Final)...');
  const nextFinalBtn = page.locator('button:has-text("Next: Final")').first();
  if (await nextFinalBtn.isVisible()) {
    await nextFinalBtn.click();
  } else {
    await page.locator('button:has-text("3 Final")').first().click();
  }
  await page.waitForTimeout(3000);

  const step3Path = path.join(ARTIFACT_DIR, 'prod_vps_local_purchase_step3.png');
  await page.screenshot({ path: step3Path, fullPage: false });
  console.log('Captured Local Purchase Step 3:', step3Path);

  await browser.close();
  console.log('=== ALL 5 PRODUCTION VERIFICATION SCREENSHOTS COMPLETED! ===');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
