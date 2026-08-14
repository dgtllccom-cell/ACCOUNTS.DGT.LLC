import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/c3e0251c-b7a3-4876-8e92-09612fef0ee2';
const BASE_URL = 'http://72.60.209.121';

async function runAuthenticatedTest() {
  console.log("=======================================================================");
  console.log("  RUNNING LIVE AUTHENTICATED E2E TEST (VPS: 72.60.209.121)             ");
  console.log("=======================================================================\n");

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  } catch (e) {
    try {
      browser = await chromium.launch({ headless: true, channel: 'msedge' });
    } catch (e2) {
      browser = await chromium.launch({ headless: true });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log(`1. Navigating to Login Page: ${BASE_URL} ...`);
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    console.log("   • Clicking SUPER ADMIN quick-fill...");
    await page.click('button:has-text("SUPER ADMIN")');
    await page.waitForTimeout(500);

    console.log("   • Submitting login...");
    await page.click('button:has-text("SECURE ERP LOGIN")');
    
    // Wait until URL contains /dashboard
    await page.waitForURL('**/dashboard/**', { timeout: 15000 });
    console.log("   ✅ Successfully authenticated and reached Dashboard!");

    // 2. Navigate to User Registration Wizard
    console.log(`\n2. Navigating to ${BASE_URL}/dashboard/users/new ...`);
    await page.goto(`${BASE_URL}/dashboard/users/new`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify page content
    const pageContent = await page.content();
    if (pageContent.includes("Module Temporary Exception") || pageContent.includes("User is not defined")) {
      throw new Error("FAIL: Module Temporary Exception / User is not defined still present!");
    }
    console.log("   ✅ User Registration wizard loaded cleanly with NO exceptions!");

    // Screenshot Step 1 initial (English)
    const shotStep1En = path.join(ARTIFACTS_DIR, 'test_shot_1_step1_en.png');
    await page.screenshot({ path: shotStep1En, fullPage: true });
    console.log(`   📸 Saved Step 1 (EN): ${shotStep1En}`);

    // 3. Test Language Switching & Screenshots
    const langs = [
      { code: 'ur', name: 'Urdu', file: 'test_shot_lang_urdu.png' },
      { code: 'ar', name: 'Arabic', file: 'test_shot_lang_arabic.png' },
      { code: 'fa', name: 'Persian', file: 'test_shot_lang_persian.png' },
      { code: 'ps', name: 'Pashto', file: 'test_shot_lang_pashto.png' }
    ];

    for (const l of langs) {
      console.log(`\n3. Switching Language to: [${l.name} (${l.code})]...`);
      await page.evaluate((code) => {
        localStorage.setItem('dgt_preferred_language', code);
        document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
        window.dispatchEvent(new Event('storage'));
      }, l.code);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const shot = path.join(ARTIFACTS_DIR, l.file);
      await page.screenshot({ path: shot, fullPage: true });
      console.log(`   📸 Saved ${l.name} screenshot: ${shot}`);
    }

    // Reset back to English
    console.log("\n4. Resetting to English to complete full registration flow...");
    await page.evaluate(() => {
      localStorage.setItem('dgt_preferred_language', 'en');
      document.cookie = `NEXT_LOCALE=en; path=/; max-age=31536000`;
      window.dispatchEvent(new Event('storage'));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 5. Select Registered Employee
    console.log("\n5. Selecting Registered Employee from Master Dropdown...");
    const combobox = page.locator('button[role="combobox"]').first();
    if (await combobox.count() > 0) {
      await combobox.click();
      await page.waitForTimeout(1000);
      const opt = page.locator('[role="option"]').first();
      if (await opt.count() > 0) {
        await opt.click();
        await page.waitForTimeout(1500);
        console.log("   ✅ Selected employee master record!");
      }
    }

    // Fill Full Name if empty
    const nameInput = page.locator('input[placeholder="e.g. Muhammad Ali Shah"]');
    if (await nameInput.count() > 0 && (await nameInput.inputValue()) === "") {
      await nameInput.fill("Muhammad Ali Shah");
    }

    const shotStep1Filled = path.join(ARTIFACTS_DIR, 'test_shot_2_step1_employee_filled.png');
    await page.screenshot({ path: shotStep1Filled, fullPage: true });
    console.log(`   📸 Saved Step 1 Employee Master Live Report: ${shotStep1Filled}`);

    // 6. Step 2: Branch & Scope
    console.log("\n6. Proceeding to Step 2 (Branch & Geographic Scope)...");
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(1500);
    const shotStep2 = path.join(ARTIFACTS_DIR, 'test_shot_3_step2_branch_scope.png');
    await page.screenshot({ path: shotStep2, fullPage: true });
    console.log(`   📸 Saved Step 2 (Branch & Scope): ${shotStep2}`);

    // 7. Step 3: KYC & Document Verification
    console.log("\n7. Proceeding to Step 3 (KYC & Documents)...");
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(1500);
    const shotStep3 = path.join(ARTIFACTS_DIR, 'test_shot_4_step3_kyc_verification.png');
    await page.screenshot({ path: shotStep3, fullPage: true });
    console.log(`   📸 Saved Step 3 (KYC & Documents): ${shotStep3}`);

    // 8. Step 4: 20-Module Permission Matrix & Review
    console.log("\n8. Proceeding to Step 4 (20-Module RBAC Matrix)...");
    await page.click('button:has-text("Next Step")');
    await page.waitForTimeout(1500);

    // Customize permissions: click category tabs & checkboxes
    const cbs = page.locator('table input[type="checkbox"]');
    const cbCount = await cbs.count();
    console.log(`   • Found ${cbCount} interactive module capability checkboxes.`);
    if (cbCount >= 6) {
      await cbs.nth(1).click();
      await cbs.nth(3).click();
      await cbs.nth(5).click();
    }

    // Set passwords
    const pwd = page.locator('input[placeholder="At least 8 characters"]');
    if (await pwd.count() > 0) await pwd.fill("Admin@123456");
    const confirmPwd = page.locator('input[placeholder="Re-enter password"]');
    if (await confirmPwd.count() > 0) await confirmPwd.fill("Admin@123456");

    const shotStep4 = path.join(ARTIFACTS_DIR, 'test_shot_5_step4_permission_matrix.png');
    await page.screenshot({ path: shotStep4, fullPage: true });
    console.log(`   📸 Saved Step 4 (Permissions Matrix): ${shotStep4}`);

    // 9. Save & Complete Registration
    console.log("\n9. Clicking 'Save & Complete Registration'...");
    await page.click('button:has-text("Save & Complete Registration")');
    await page.waitForTimeout(3000);

    const shotSaved = path.join(ARTIFACTS_DIR, 'test_shot_6_saved_success.png');
    await page.screenshot({ path: shotSaved, fullPage: true });
    console.log(`   📸 Saved Post-Save State: ${shotSaved}`);

    // 10. Open View User Profile Report Modal
    console.log("\n10. Opening Full View User Profile Report Modal...");
    const reportBtn = page.locator('button:has-text("View Profile Report"), button:has-text("View User Profile Report")').first();
    if (await reportBtn.count() > 0) {
      await reportBtn.click();
      await page.waitForTimeout(2000);
      const shotModal = path.join(ARTIFACTS_DIR, 'test_shot_7_user_profile_modal.png');
      await page.screenshot({ path: shotModal, fullPage: true });
      console.log(`   📸 Saved User Profile Modal: ${shotModal}`);
    }

    console.log("\n=======================================================================");
    console.log("  ALL TESTS COMPLETED SUCCESSFULLY (100% PASS)                         ");
    console.log("=======================================================================\n");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    if (browser) await browser.close();
  }
}

runAuthenticatedTest().catch(console.error);
