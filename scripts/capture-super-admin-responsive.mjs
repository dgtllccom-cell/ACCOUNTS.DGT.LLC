import { chromium, devices } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/3c818315-a98f-4fc0-b7f6-9545592a32f3';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch();

  // Helper to login and get page
  const setupContext = async (contextOptions) => {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    
    // Go to login page
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Fill credentials
    const idInput = page.locator('input[name="identifier"], input[type="text"], input[type="email"]').first();
    const passInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();
    
    await idInput.fill('superadmin@dgt.llc');
    await passInput.fill('Chaman@9090');
    await submitBtn.click();
    
    // Wait for navigation away from login
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });
    await page.waitForTimeout(1000);
    return { context, page };
  };

  console.log('1. Capturing Desktop view with compact Country Performance...');
  try {
    const { page } = await setupContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(`${BASE_URL}/dashboard/super-admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const desktopPath = path.join(ARTIFACT_DIR, 'super_admin_desktop_view.png');
    await page.screenshot({ path: desktopPath });
    console.log('Desktop view saved:', desktopPath);

    console.log('2. Clicking VIEW ALL to open Country Performance Modal (پردہ)...');
    const viewAllBtn = page.locator('button:has-text("VIEW ALL")').first();
    await viewAllBtn.click();
    await page.waitForTimeout(1500);
    const modalPath = path.join(ARTIFACT_DIR, 'super_admin_country_modal.png');
    await page.screenshot({ path: modalPath });
    console.log('Country Performance Modal saved:', modalPath);

    console.log('3. Clicking on Pakistan row to show Country Drilldown view...');
    const pakistanRow = page.locator('tr:has-text("Pakistan")').first();
    if (await pakistanRow.count() > 0) {
      await pakistanRow.click();
      await page.waitForTimeout(1500);
      const drilldownPath = path.join(ARTIFACT_DIR, 'super_admin_country_drilldown.png');
      await page.screenshot({ path: drilldownPath });
      console.log('Country Drilldown saved:', drilldownPath);
    }

    await page.close();
  } catch (err) {
    console.error('Error capturing desktop/modal:', err.message);
  }

  console.log('4. Capturing Mobile iPhone view...');
  try {
    const iPhone = devices['iPhone 15 Pro'];
    const { page } = await setupContext({
      ...iPhone,
      deviceScaleFactor: 2,
    });
    await page.goto(`${BASE_URL}/dashboard/super-admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const mobilePath = path.join(ARTIFACT_DIR, 'super_admin_mobile_iphone_en.png');
    await page.screenshot({ path: mobilePath });
    console.log('Mobile iPhone English saved:', mobilePath);

    // Scroll to charts and Country Performance
    await page.evaluate(() => window.scrollBy(0, 1100));
    await page.waitForTimeout(1000);
    const mobileScrolledPath = path.join(ARTIFACT_DIR, 'super_admin_mobile_iphone_scrolled.png');
    await page.screenshot({ path: mobileScrolledPath });
    console.log('Mobile iPhone Scrolled saved:', mobileScrolledPath);

    await page.close();
  } catch (err) {
    console.error('Error capturing mobile:', err.message);
  }

  await browser.close();
  console.log('All updated captures complete!');
}

run().catch((err) => {
  console.error('Fatal error in capture script:', err);
  process.exit(1);
});
