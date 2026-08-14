import { chromium } from '@playwright/test';

const BASE_URL = 'http://72.60.209.121';

async function testStep4() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('input[name="identifier"]', 'superadmin@damaan.com');
  await page.fill('input[name="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to wizard
  console.log('Navigating to wizard...');
  await page.goto(`${BASE_URL}/dashboard/users/new`);
  await page.waitForTimeout(2000);

  // Step 1: Select Employee
  console.log('Step 1: Selecting employee...');
  const dropdown = page.locator('button[role="combobox"]').first();
  if (await dropdown.count() > 0) {
    await dropdown.click();
    await page.waitForTimeout(1000);
    const firstOpt = page.locator('[role="option"]').first();
    if (await firstOpt.count() > 0) await firstOpt.click();
    await page.waitForTimeout(1000);
  }

  // Ensure full name is present
  const nameInput = page.locator('input[placeholder="e.g. Muhammad Ali Shah"]');
  if (await nameInput.count() > 0 && (await nameInput.inputValue()) === "") {
    await nameInput.fill("Muhammad Ali Shah");
  }

  // Go Step 1 -> Step 2
  console.log('Going to Step 2...');
  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(1500);

  // Step 2: Select Country if needed
  console.log('Step 2: Checking Country selection...');
  const countrySelect = page.locator('button[role="combobox"]').first();
  if (await countrySelect.count() > 0) {
    await countrySelect.click();
    await page.waitForTimeout(500);
    const firstCountry = page.locator('[role="option"]').first();
    if (await firstCountry.count() > 0) await firstCountry.click();
    await page.waitForTimeout(500);
  }

  // Go Step 2 -> Step 3
  console.log('Going to Step 3...');
  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(1500);

  // Go Step 3 -> Step 4
  console.log('Going to Step 4...');
  await page.click('button:has-text("Next Step")');
  await page.waitForTimeout(1500);

  // Step 4: Fill password inputs
  console.log('Filling passwords in Step 4...');
  const pwInput = page.locator('input[placeholder="At least 8 characters"]');
  const cpwInput = page.locator('input[placeholder="Re-enter password"]');
  await pwInput.fill('Admin@123456');
  await cpwInput.fill('Admin@123456');
  await page.waitForTimeout(1000);

  // Listen to response
  page.on('response', async (res) => {
    if (res.url().includes('/api/erp/users') && res.request().method() === 'POST') {
      console.log('--- POST /api/erp/users RESPONSE ---');
      console.log('Status:', res.status());
      try {
        console.log('Body:', JSON.stringify(await res.json(), null, 2));
      } catch (e) {
        console.log('Text:', await res.text());
      }
    }
  });

  // Check save button state
  const saveBtn = page.locator('button:has-text("Save & Complete Registration")').first();
  const isDisabled = await saveBtn.isDisabled();
  console.log('Save button disabled:', isDisabled);

  if (!isDisabled) {
    console.log('Clicking Save button...');
    await saveBtn.click();
    await page.waitForTimeout(4000);
  }

  await browser.close();
}

testStep4().catch(console.error);
