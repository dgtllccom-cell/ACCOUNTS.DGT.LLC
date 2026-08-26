import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const envPath = path.join(ROOT, ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const sessionSecret = env.ERP_SESSION_SECRET;
if (!sessionSecret) throw new Error("ERP_SESSION_SECRET missing");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const outDir = path.join(ROOT, "tmp", "browser-proof");
fs.mkdirSync(outDir, { recursive: true });

const payload = {
  v: 1,
  kind: "temp",
  userId: "00000000-0000-4000-8000-000000000001",
  email: "superadmin@damaan.com",
  fullName: "Super Admin",
  roles: ["super_admin"],
  createdAt: Date.now()
};
const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
const sig = crypto.createHmac("sha256", sessionSecret).update(b64).digest("base64url");

const langs = ["en", "ur", "ar", "fa", "ps"];
const pages = [
  { slug: "/dashboard/documents", name: "documents" },
  { slug: "/dashboard/kyc-reports", name: "kyc-reports" }
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
await context.addCookies([
  { name: "erp_session", value: `${b64}.${sig}`, url: baseUrl },
  { name: "erp_lang", value: "en", url: baseUrl }
]);

for (const lang of langs) {
  await context.addCookies([{ name: "erp_lang", value: lang, url: baseUrl }]);
  for (const pageInfo of pages) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${pageInfo.slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const title = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const file = path.join(outDir, `${pageInfo.name}-${lang}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(JSON.stringify({ lang, page: pageInfo.slug, title: title.slice(0, 200), file }));
    await page.close();
  }
}

await browser.close();
