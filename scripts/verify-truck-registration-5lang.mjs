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

const LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    dir: 'ltr',
    expectedTitle: 'Clearing Truck Registration',
    expectedOwnerCard: 'Truck Owner Information',
    expectedStepPill: 'Step 1 of 5',
    expectedReportTitle: 'Live Truck Report',
    expectedSec1: '1. TRANSPORT OWNER & COMPANY DETAILS',
    expectedSec2: '2. TRUCK DETAILS',
    expectedSec3: '3. DRIVER DETAILS',
    expectedBadge: 'PERMANENT',
  },
  {
    code: 'ur',
    name: 'Urdu',
    dir: 'rtl',
    expectedTitle: 'کلیرنگ ٹرک رجسٹریشن',
    expectedOwnerCard: 'ٹرک کے مالک کی معلومات',
    expectedStepPill: '1 سے 5 مرحلہ',
    expectedReportTitle: 'ٹرک کی براہ راست رپورٹ',
    expectedSec1: '1. ٹرانسپورٹ مالک اور کمپنی کی تفصیلات',
    expectedSec2: '2. ٹرک کی تفصیلات',
    expectedSec3: '3. ڈرائیور کی تفصیلات',
    expectedBadge: 'مستقل',
  },
  {
    code: 'ar',
    name: 'Arabic',
    dir: 'rtl',
    expectedTitle: 'تسجيل شاحنات التخليص',
    expectedOwnerCard: 'معلومات مالك الشاحنة',
    expectedStepPill: 'الخطوة 1 من 5',
    expectedReportTitle: 'التقرير الحي للشاحنات',
    expectedSec1: '1. بيانات مالك النقل والشركة',
    expectedSec2: '2. بيانات الشاحنة',
    expectedSec3: '3. بيانات السائق',
    expectedBadge: 'دائم',
  },
  {
    code: 'fa',
    name: 'Farsi',
    dir: 'rtl',
    expectedTitle: 'ثبت کامیون‌های ترخیص',
    expectedOwnerCard: 'اطلاعات مالک کامیون',
    expectedStepPill: 'مرحله 1 از 5',
    expectedReportTitle: 'گزارش زنده کامیون‌ها',
    expectedSec1: '1. مشخصات مالک و شرکت حمل و نقل',
    expectedSec2: '2. مشخصات کامیون',
    expectedSec3: '3. مشخصات راننده',
    expectedBadge: 'دائمی',
  },
  {
    code: 'ps',
    name: 'Pashto',
    dir: 'rtl',
    expectedTitle: 'د کلیرنګ لارۍ راجستر',
    expectedOwnerCard: 'د لارۍ د خاوند معلومات',
    expectedStepPill: 'له 1 تر 5 مرحله',
    expectedReportTitle: 'د لارۍ ژوندۍ راپور',
    expectedSec1: '1. د ټرانسپورټ مالک او شرکت تفصیلات',
    expectedSec2: '2. د لارۍ تفصیلات',
    expectedSec3: '3. د ډریور تفصیلات',
    expectedBadge: 'دايمي',
  },
];

async function main() {
  console.log('Starting Playwright 5-Language & Responsive Suite for Truck Registration...');
  const browser = await chromium.launch({ headless: true });
  const results = [];

  const loginRes = await fetch(`${TARGET_HOST}/api/erp/auth/dev-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'super_admin', isSuperAdmin: true })
  });
  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  const erpSessionMatch = rawCookies.find(c => c && c.includes('erp_session='));
  const superToken = erpSessionMatch.match(/erp_session=([^;]+)/)[1];
  console.log('Obtained authentic super_admin session token from server.');

  try {
    for (const lang of LANGUAGES) {
      console.log(`\n======================================================`);
      console.log(`Testing Language: ${lang.name} (${lang.code.toUpperCase()}) - Direction: ${lang.dir.toUpperCase()}`);
      console.log(`======================================================`);

      const context = await browser.newContext({
        viewport: { width: 1440, height: 920 },
        locale: lang.code
      });

      await context.addCookies([
        { name: 'erp_session', value: superToken, domain: 'localhost', path: '/' },
        { name: 'erp_lang', value: lang.code, domain: 'localhost', path: '/' }
      ]);

      await context.addInitScript((l) => {
        try {
          localStorage.setItem('erp_lang', l);
          localStorage.setItem('erp_app_install_dismissed', '1');
        } catch {}
      }, lang.code);

      const page = await context.newPage();
      await page.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration?lang=${lang.code}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.locator('#ownerCard').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(2000);

      // 1. Check HTML direction
      const htmlDir = await page.getAttribute('html', 'dir');
      const isDirCorrect = htmlDir === lang.dir;
      console.log(`[${lang.code}] HTML dir: ${htmlDir} (expected: ${lang.dir}) => ${isDirCorrect ? 'PASS' : 'FAIL'}`);

      // 2. Check sidebar position
      const asideBox = await page.locator('aside').first().boundingBox();
      const pageViewport = page.viewportSize();
      let sidebarSide = 'left';
      if (asideBox && pageViewport) {
        sidebarSide = asideBox.x > (pageViewport.width / 2) ? 'right' : 'left';
      }
      const expectedSidebarSide = lang.dir === 'rtl' ? 'right' : 'left';
      const isSidebarCorrect = sidebarSide === expectedSidebarSide;
      console.log(`[${lang.code}] Sidebar position: ${sidebarSide} (expected: ${expectedSidebarSide}) => ${isSidebarCorrect ? 'PASS' : 'FAIL'}`);

      // 3. Check page title
      const titleText = await page.locator('#trk-page-title').textContent();
      const hasTitle = titleText?.includes(lang.expectedTitle);
      console.log(`[${lang.code}] Page Title: "${titleText?.trim()}" (expected: "${lang.expectedTitle}") => ${hasTitle ? 'PASS' : 'FAIL'}`);

      // 4. Check Card 1 Header & Step Pill
      const ownerCardTitle = await page.locator('#ownerCard h2').textContent();
      const hasOwnerTitle = ownerCardTitle?.includes(lang.expectedOwnerCard);
      console.log(`[${lang.code}] Card 1 Title: "${ownerCardTitle?.trim()}" (expected: "${lang.expectedOwnerCard}") => ${hasOwnerTitle ? 'PASS' : 'FAIL'}`);

      const stepPill = await page.locator('#ownerCard span.rounded-full').first().textContent();
      const hasStepPill = stepPill?.includes(lang.expectedStepPill);
      console.log(`[${lang.code}] Step Pill: "${stepPill?.trim()}" (expected: "${lang.expectedStepPill}") => ${hasStepPill ? 'PASS' : 'FAIL'}`);

      // 5. Check Live Truck Report header & sections
      const reportTitle = await page.locator('aside.dgt-trk-report-card h3').textContent();
      const hasReportTitle = reportTitle?.includes(lang.expectedReportTitle);
      console.log(`[${lang.code}] Report Title: "${reportTitle?.trim()}" (expected: "${lang.expectedReportTitle}") => ${hasReportTitle ? 'PASS' : 'FAIL'}`);

      const liveReportContent = await page.locator('#trk-live-report').textContent();
      const hasSec1 = liveReportContent?.includes(lang.expectedSec1);
      const hasSec2 = liveReportContent?.includes(lang.expectedSec2);
      const hasSec3 = liveReportContent?.includes(lang.expectedSec3);
      const hasBadge = liveReportContent?.includes(lang.expectedBadge);

      console.log(`[${lang.code}] Section 1: ${hasSec1 ? 'PASS' : 'FAIL'} ("${lang.expectedSec1}")`);
      console.log(`[${lang.code}] Section 2: ${hasSec2 ? 'PASS' : 'FAIL'} ("${lang.expectedSec2}")`);
      console.log(`[${lang.code}] Section 3: ${hasSec3 ? 'PASS' : 'FAIL'} ("${lang.expectedSec3}")`);
      console.log(`[${lang.code}] Driver Badge: ${hasBadge ? 'PASS' : 'FAIL'} ("${lang.expectedBadge}")`);

      // 6. Check No Large Stepper is present
      const largeStepper = await page.locator('nav.dgt-trk-stepper').count();
      const noLargeStepper = largeStepper === 0;
      console.log(`[${lang.code}] No Large Stepper 1-5 navigation: ${noLargeStepper ? 'PASS (Properly removed)' : 'FAIL'}`);

      // Take desktop screenshot
      const shotFilename = `truck_reg_${lang.code}_desktop.png`;
      const shotPath = path.join(ARTIFACT_DIR, shotFilename);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`Saved screenshot: ${shotPath}`);

      results.push({
        lang: lang.code,
        name: lang.name,
        dir: lang.dir,
        htmlDir,
        sidebarSide,
        isDirCorrect,
        isSidebarCorrect,
        hasTitle,
        hasOwnerTitle,
        hasStepPill,
        hasReportTitle,
        hasSec1,
        hasSec2,
        hasSec3,
        hasBadge,
        noLargeStepper,
        screenshot: shotFilename,
        pass: isDirCorrect && isSidebarCorrect && hasTitle && hasOwnerTitle && hasStepPill && hasReportTitle && hasSec1 && hasSec2 && hasSec3 && hasBadge && noLargeStepper
      });

      await context.close();
    }

    // -------------------------------------------------------------
    // MOBILE / TABLET VIEWPORT TEST (e.g. 375x812 Mobile View)
    // -------------------------------------------------------------
    console.log(`\n======================================================`);
    console.log(`Testing Mobile Viewport (375x812) - English & Urdu`);
    console.log(`======================================================`);

    for (const mCode of ['en', 'ur']) {
      const mContext = await browser.newContext({
        viewport: { width: 375, height: 812 },
        isMobile: true,
        locale: mCode
      });
      await mContext.addCookies([
        { name: 'erp_session', value: superToken, domain: 'localhost', path: '/' },
        { name: 'erp_lang', value: mCode, domain: 'localhost', path: '/' }
      ]);
      await mContext.addInitScript((l) => {
        try {
          localStorage.setItem('erp_lang', l);
          localStorage.setItem('erp_app_install_dismissed', '1');
        } catch {}
      }, mCode);
      const mPage = await mContext.newPage();
      await mPage.goto(`${TARGET_HOST}/dashboard/clearing-agent/truck-registration?lang=${mCode}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await mPage.locator('#ownerCard').waitFor({ state: 'visible', timeout: 30000 });
      await mPage.waitForTimeout(2000);

      const mShotFilename = `truck_reg_${mCode}_mobile.png`;
      const mShotPath = path.join(ARTIFACT_DIR, mShotFilename);
      await mPage.screenshot({ path: mShotPath, fullPage: false });
      console.log(`Saved mobile screenshot: ${mShotPath}`);
      await mContext.close();
    }

    console.log('\n================ ALL TESTS FINISHED ================');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Test Suite Error:', err);
  } finally {
    await browser.close();
  }
}

main();
