import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import path from 'path';
import fs from 'fs';

const TARGET_HOST = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\558fdcf7-a68b-4077-bb1e-3d6fd199eb9e';
const SESSION_SECRET = 'c0734b4690f88f3d2878efd9ace71db7eac681d5a22f52ac64d540c4a41d661d';

function buildSessionToken({ role, isSuperAdmin, fullName, email, countryId = null, cityBranchId = null, countryBranchId = null }) {
  const payload = {
    v: 1,
    kind: "temp",
    userId: isSuperAdmin ? "00000000-0000-4000-8000-000000000001" : `user-${role}-test-id`,
    email: email || `${role}@dgt.llc`,
    fullName: fullName || "Test User",
    roles: [role],
    isSuperAdmin: !!isSuperAdmin,
    assignments: [
      {
        role,
        countryId,
        countryBranchId,
        cityBranchId,
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

async function runVerification() {
  console.log('Starting Playwright Truck Registration Verification...');
  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // TEST 1: Super Admin View (Full 3D Blue-and-White Dashboard)
    // -------------------------------------------------------------
    console.log('1. Testing Super Admin View...');
    const superToken = buildSessionToken({
      role: 'super_admin',
      isSuperAdmin: true,
      fullName: 'Super Admin (Global Group)',
      email: 'superadmin@dgt.llc'
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await context.addCookies([
      { name: 'erp_session', value: superToken, domain: 'localhost', path: '/' },
      { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
    ]);

    const page = await context.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', (req) => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
    page.on('response', (res) => {
      if (res.url().includes('trucks')) {
        console.log('TRUCKS API STATUS:', res.status(), res.url());
      }
    });
    await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const actionBtn = page.locator('#header-actions-menu-btn');
    await actionBtn.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);

    const superAdminPath = path.join(ARTIFACT_DIR, 'truck_registration_super_admin.png');
    await page.screenshot({ path: superAdminPath, fullPage: false });
    console.log(`Saved Super Admin screenshot: ${superAdminPath}`);

    // Test three-dot actions menu
    console.log('2. Testing Three-Dot Actions Menu...');
    await actionBtn.click();
    await page.waitForTimeout(600);
    const exportPdfText = page.locator('text=Export PDF');
    if (!await exportPdfText.isVisible()) {
      await actionBtn.click();
      await page.waitForTimeout(600);
    }
    const menuPath = path.join(ARTIFACT_DIR, 'truck_registration_actions_menu.png');
    await page.screenshot({ path: menuPath, fullPage: false });
    console.log(`Saved Actions Menu screenshot: ${menuPath}`);

    // Click Columns item to open columns popover
    const columnsBtn = page.locator('button:has-text("Columns")');
    if (await columnsBtn.isVisible()) {
      await columnsBtn.click();
      await page.waitForTimeout(600);
      const colPath = path.join(ARTIFACT_DIR, 'truck_registration_columns_popover.png');
      await page.screenshot({ path: colPath, fullPage: false });
      console.log(`Saved Columns popover screenshot: ${colPath}`);
      // Close columns popover by clicking outside or pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Wait for table rows to be loaded
    await page.waitForSelector('td:has-text("7888")', { timeout: 15000 });

    // Test Search filter
    console.log('3. Testing Search Filter for "7888"...');
    const searchInput = page.locator('input[placeholder*="Search by Truck No"]').first();
    await searchInput.click();
    await searchInput.fill('7888');
    await page.waitForTimeout(600);
    const searchPath = path.join(ARTIFACT_DIR, 'truck_registration_search_7888.png');
    await page.screenshot({ path: searchPath, fullPage: false });
    console.log(`Saved Search 7888 screenshot: ${searchPath}`);
    await searchInput.fill('');
    await page.waitForTimeout(600);

    await context.close();

    // -------------------------------------------------------------
    // TEST 2: Multilingual Urdu Script & Localized Display
    // -------------------------------------------------------------
    console.log('4. Testing Multilingual Urdu View...');
    const urduContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await urduContext.addCookies([
      { name: 'erp_session', value: superToken, domain: 'localhost', path: '/' },
      { name: 'erp_lang', value: 'ur', domain: 'localhost', path: '/' }
    ]);
    const urduPage = await urduContext.newPage();
    await urduPage.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await urduPage.waitForTimeout(3000);

    const urduPath = path.join(ARTIFACT_DIR, 'truck_registration_urdu.png');
    await urduPage.screenshot({ path: urduPath, fullPage: false });
    console.log(`Saved Urdu screenshot: ${urduPath}`);
    await urduContext.close();

    // -------------------------------------------------------------
    // TEST 3: Country Admin Role Isolation
    // -------------------------------------------------------------
    console.log('5. Testing Country Admin View...');
    const countryToken = buildSessionToken({
      role: 'country_admin',
      isSuperAdmin: false,
      fullName: 'Pakistan Country Admin',
      email: 'pkadmin@dgt.llc',
      countryId: 'country-pk'
    });
    const countryContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await countryContext.addCookies([
      { name: 'erp_session', value: countryToken, domain: 'localhost', path: '/' },
      { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
    ]);
    const countryPage = await countryContext.newPage();
    await countryPage.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await countryPage.waitForTimeout(3000);

    const countryPath = path.join(ARTIFACT_DIR, 'truck_registration_country_admin.png');
    await countryPage.screenshot({ path: countryPath, fullPage: false });
    console.log(`Saved Country Admin screenshot: ${countryPath}`);
    await countryContext.close();

    // -------------------------------------------------------------
    // TEST 4: Branch User Role Isolation
    // -------------------------------------------------------------
    console.log('6. Testing Branch User View...');
    const branchToken = buildSessionToken({
      role: 'city_branch_admin',
      isSuperAdmin: false,
      fullName: 'Chaman Branch Operator',
      email: 'chaman@dgt.llc',
      countryId: 'country-pk',
      cityBranchId: 'branch-chaman'
    });
    const branchContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    await branchContext.addCookies([
      { name: 'erp_session', value: branchToken, domain: 'localhost', path: '/' },
      { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
    ]);
    const branchPage = await branchContext.newPage();
    await branchPage.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await branchPage.waitForTimeout(3000);

    const branchPath = path.join(ARTIFACT_DIR, 'truck_registration_branch_user.png');
    await branchPage.screenshot({ path: branchPath, fullPage: false });
    console.log(`Saved Branch User screenshot: ${branchPath}`);
    await branchContext.close();

    // -------------------------------------------------------------
    // TEST 5: Tablet & Mobile Responsive Views
    // -------------------------------------------------------------
    console.log('7. Testing Responsive Tablet View (768x1024)...');
    const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    await tabletContext.addCookies([
      { name: 'erp_session', value: superToken, domain: 'localhost', path: '/' },
      { name: 'erp_lang', value: 'en', domain: 'localhost', path: '/' }
    ]);
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await tabletPage.waitForTimeout(3000);

    const tabletPath = path.join(ARTIFACT_DIR, 'truck_registration_tablet.png');
    await tabletPage.screenshot({ path: tabletPath, fullPage: false });
    console.log(`Saved Tablet screenshot: ${tabletPath}`);
    await tabletContext.close();

    console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runVerification();
