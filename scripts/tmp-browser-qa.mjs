import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = "http://localhost:3000";
const outDir = path.join(
  "C:\\Users\\dgtll\\.codex\\visualizations\\2026\\08\\13\\019ffa79-ac0e-7050-acc0-a9af75f5d582",
  "kyc-docs-proof"
);
fs.mkdirSync(outDir, { recursive: true });

const login = await fetch(`${root}/api/erp/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: "superadmin", password: "Admin@123" }),
});
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) {
  throw new Error("Login did not return erp_session cookie");
}
const [cookieName, ...cookieValueParts] = cookie.split("=");
const cookieValue = cookieValueParts.join("=");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: root, viewport: { width: 1600, height: 1200 } });
await context.addCookies([
  { name: cookieName, value: cookieValue, domain: "localhost", path: "/" }
]);

async function capture(lang, url, name, waitForText) {
  const page = await context.newPage();
  await page.addInitScript((language) => {
    localStorage.setItem("erp_lang", language);
    document.documentElement.lang = language;
  }, lang);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate((language) => {
    localStorage.setItem("erp_lang", language);
    document.documentElement.lang = language;
    window.dispatchEvent(new Event("erp_language_changed"));
  }, lang);
  await page.waitForTimeout(10000);
  const text = await page.locator("body").innerText().catch(() => "");
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log(JSON.stringify({ lang, url, file, contains: waitForText, textSample: text.slice(0, 1500) }, null, 2));
  await page.close();
}

await capture("en", "/dashboard/kyc-reports", "kyc-reports-en.png", "KYC Reports");
await capture("ur", "/dashboard/kyc-reports", "kyc-reports-ur.png", "KYC رپورٹس");
await capture("en", "/dashboard/documents", "documents-en.png", "Documents");
await capture("ur", "/dashboard/docum