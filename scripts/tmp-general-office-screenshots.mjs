import { chromium } from "playwright";
import fs from "node:fs/promises";

const baseURL = process.env.BASE_URL || "http://localhost:3001";
const outDir = process.env.OUT_DIR || process.cwd();

async function capture(lang, fileName) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((nextLang) => {
    localStorage.setItem("erp_lang", nextLang);
    document.cookie = `erp_lang=${encodeURIComponent(nextLang)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.documentElement.lang = nextLang;
  }, lang);
  const page = await context.newPage();
  await page.goto(`${baseURL}/dashboard/general-office/employees`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}\\${fileName}`, fullPage: true });
  const bodyText = await page.locator("body").innerText();
  await browser.close();
  return bodyText;
}

const urText = await capture("ur", "general-office-employees-ur.png");
const enText = await capture("en", "general-office-employees-en.png");
await fs.writeFile(`${outDir}\\general-office-employees-text.txt`, `---UR---\n${urText}\n\n---EN---\n${enText}\n`, "utf8");
