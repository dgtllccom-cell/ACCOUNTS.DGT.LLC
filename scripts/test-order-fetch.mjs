import { chromium } from "playwright";
import fs from "node:fs";

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const TEST_PASSWORD = process.env.DGT_TEST_PASSWORD || env.DGT_TEST_PASSWORD;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://72.60.209.121/auth/login");
  await page.locator('input[name="identifier"], #identifier, input[type="text"]').first().fill("superadmin@dgt.llc");
  await page.locator('input[name="password"], #password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("SECURE ERP LOGIN"), button[type="submit"]').first().click({ noWaitAfter: true });
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 35000 });

  const data = await page.evaluate(async () => {
    const res = await fetch("/api/erp/clearing-agent/customer-order");
    const json = await res.json();
    return json;
  });

  console.log("Fetch result count:", data.data?.length, "error:", data.error);
  if (data.data && data.data.length > 0) {
    console.log("Orders:", data.data.map((d) => ({ id: d.id, no: d.order_no, cust: d.customer_name, status: d.status })));
  }
  await browser.close();
}

main().catch(console.error);
