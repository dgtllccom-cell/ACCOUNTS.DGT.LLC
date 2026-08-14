import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/c3e0251c-b7a3-4876-8e92-09612fef0ee2';

async function checkLogin() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  
  await page.goto('http://72.60.209.121/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'login_debug_1.png') });

  // Click SUPER ADMIN button
  await page.click('button:has-text("SUPER ADMIN")');
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'login_debug_2_filled.png') });

  // Click submit
  await page.click('button[type="submit"], button:has-text("SECURE ERP LOGIN")');
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'login_debug_3_after_click.png') });
  console.log("Current URL after login attempt:", page.url());

  await browser.close();
}

checkLogin().catch(console.error);
