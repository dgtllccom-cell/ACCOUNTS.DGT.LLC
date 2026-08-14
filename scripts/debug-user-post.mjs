import { chromium } from '@playwright/test';

const BASE_URL = 'http://72.60.209.121';

async function testStep4() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();

  // Login
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="identifier"]', 'superadmin@damaan.com');
  await page.fill('input[name="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to wizard
  await page.goto(`${BASE_URL}/dashboard/users/new`);
  await page.waitForTimeout(2000);

  // Step 1: Select Employee
  const dropdown = page.locator('button[role="combobox"]').first();
  if (await dropdown.count() > 0) {
    await dropdown.click();
    await page.waitForTimeout(1000);
    const firstOpt = page.locator('[role="option"]').first();
    if (await firstOpt.count() > 0) await firstOpt.click();
  }

  // Go through Steps
  const nextBtn = page.locator('button:has-text("Next")').first();
  await nextBtn.click();
  await page.waitForTimeout(1000);
  await nextBtn.click();
  await page.waitForTimeout(1000);
  await nextBtn.click();
  await page.waitForTimeout(1000);

  // Step 4: Fill password inputs
  const pwInputs = page.locator('input[type="password"]');
  console.log('Password input count:', await pwInputs.count());
  if (await pwInputs.count() >= 2) {
    await pwInputs.nth(0).fill('Admin@123456');
    await pwInputs.nth(1).fill('Admin@123456');
    await page.waitForTimeout(500);
  }

  // Check save button state
  const saveBtn = page.locator('button:has-text("Save & Complete Registration"), button:has-text("Save")').first();
  const isDisabled = await saveBtn.isDisabled();
  console.log('Save button disabled:', isDisabled);

  if (!isDisabled) {
    page.on('response', async (res) => {
      if (res.url().includes('/api/erp/users')) {
        console.log('API Response:', res.status(), await res.text());
      }
    });
    await saveBtn.click();
    await page.waitForTimeout(3000);
  }

  await browser.close();
}

testStep4().catch(console.error);
