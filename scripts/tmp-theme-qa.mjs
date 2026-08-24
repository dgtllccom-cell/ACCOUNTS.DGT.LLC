import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = 'http://localhost:3000';
const outDir = path.resolve(process.cwd(), 'theme-proof');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
const page = await context.newPage();

async function login() {
  await page.goto(`${base}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('#identifier', 'superadmin@damaan.com');
  await page.fill('#password', 'Admin@123');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/dashboard\//, { timeout: 60000 });
}

async function setPrefs(lang, themeMode) {
  await page.evaluate(({ lang, themeMode }) => {
    localStorage.setItem('erp_lang', lang);
    document.cookie = `erp_lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    localStorage.setItem('erp_theme_mode', themeMode);
    localStorage.setItem('erp_theme', themeMode === 'night' ? 'dark' : 'light');
    document.cookie = `erp_theme_mode=${encodeURIComponent(themeMode)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, { lang, themeMode });
}

await login();
await page.goto(`${base}/dashboard/general-office/employees`, { waitUntil: 'networkidle' });

const langs = ['en', 'ur', 'ar', 'fa', 'ps'];
for (const lang of langs) {
  await setPrefs(lang, 'day');
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, `general-office-${lang}-day.png`), fullPage: true });
}

const themes = ['day', 'soft', 'green', 'night'];
for (const themeMode of themes) {
  await setPrefs('en', themeMode);
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, `general-office-en-${themeMode}.png`), fullPage: true });
}

await browser.close();
console.log('saved', outDir);
