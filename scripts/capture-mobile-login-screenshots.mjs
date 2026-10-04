import { chromium, devices } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/dgtll/.gemini/antigravity-ide/brain/3c818315-a98f-4fc0-b7f6-9545592a32f3';

async function run() {
  const browser = await chromium.launch();

  // 1. iPhone 15 Pro Mobile View (English)
  const iPhone = devices['iPhone 15 Pro'];
  const iphoneContext = await browser.newContext({
    ...iPhone,
    deviceScaleFactor: 2,
  });
  const page1 = await iphoneContext.newPage();
  await page1.goto('http://72.60.209.121/auth/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page1.waitForTimeout(2000);
  const iphonePath = path.join(ARTIFACT_DIR, 'mobile_login_iphone_en.png');
  await page1.screenshot({ path: iphonePath, fullPage: true });
  console.log('Saved iPhone screenshot:', iphonePath);

  // 2. iPhone 15 Pro Mobile View (Urdu RTL)
  const iphoneUrduContext = await browser.newContext({
    ...iPhone,
    deviceScaleFactor: 2,
  });
  await iphoneUrduContext.addCookies([
    { name: 'erp_lang', value: 'ur', domain: '72.60.209.121', path: '/' },
    { name: 'NEXT_LOCALE', value: 'ur', domain: '72.60.209.121', path: '/' }
  ]);
  const page2 = await iphoneUrduContext.newPage();
  await page2.goto('http://72.60.209.121/auth/login?lang=ur', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page2.waitForTimeout(2000);
  const iphoneUrduPath = path.join(ARTIFACT_DIR, 'mobile_login_iphone_ur.png');
  await page2.screenshot({ path: iphoneUrduPath, fullPage: true });
  console.log('Saved iPhone Urdu screenshot:', iphoneUrduPath);

  // 3. Android / Samsung View (English)
  const pixel = devices['Pixel 7'];
  const androidContext = await browser.newContext({
    ...pixel,
    deviceScaleFactor: 2,
  });
  const page3 = await androidContext.newPage();
  await page3.goto('http://72.60.209.121/auth/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page3.waitForTimeout(2000);
  const androidPath = path.join(ARTIFACT_DIR, 'mobile_login_android_en.png');
  await page3.screenshot({ path: androidPath, fullPage: true });
  console.log('Saved Android screenshot:', androidPath);

  // 4. UI Preview Dual Device Frames Page
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 2,
  });
  const page4 = await desktopContext.newPage();
  await page4.goto('http://72.60.209.121/ui-preview/mobile-login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page4.waitForTimeout(2500);
  const previewPath = path.join(ARTIFACT_DIR, 'mobile_preview_dual_devices.png');
  await page4.screenshot({ path: previewPath, fullPage: true });
  console.log('Saved Preview dual devices screenshot:', previewPath);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
