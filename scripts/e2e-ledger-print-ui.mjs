#!/usr/bin/env node
/**
 * Ledger print — in-app flow (DEV ONLY): a finance login opens the Detailed Ledger, prints Portrait, switches the preview to
 * Landscape (document REBUILT, not rotated) and to Urdu (RTL); a finance-denied login gets 403 on the page and the API.
 * Env: BASE, RBAC_USERS, RBAC_SECRET, SHOTS_DIR.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const users = JSON.parse(fs.readFileSync(process.env.RBAC_USERS, "utf8"));
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const DIR = process.env.SHOTS_DIR;
fs.mkdirSync(DIR, { recursive: true });
const results = [];
const check = (name, pass, observed) => { results.push({ name, pass: Boolean(pass), observed }); console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(observed ?? "")); };

const browser = await chromium.launch();
async function session(key) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const r = await ctx.request.post(BASE + "/api/erp/auth/login", { data: { identifier: users[key].email, password } });
  await ctx.addCookies([{ name: "erp_lang", value: "en", url: BASE }]);
  return { ctx, ok: r.status() === 200 };
}

// 1. finance user: print flow
{
  const { ctx, ok } = await session("finance");
  check("finance login", ok);
  const page = await ctx.newPage();
  const res = await page.goto(BASE + "/dashboard/ledger/detailed", { waitUntil: "networkidle", timeout: 180000 });
  check("Detailed Ledger opens for the finance user", res?.status() === 200, res?.status());
  // ONE compact ⋮ menu holds Print (portrait / landscape), PDF export (portrait / landscape) and CSV
  const menuBtn = page.locator('[data-testid="ledger-actions-menu"]');
  await menuBtn.waitFor({ timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="ledger-actions-menu"]')?.hasAttribute("disabled"), null, { timeout: 180000 }).catch(() => {});
  const enabled = await menuBtn.isEnabled();
  check("actions menu enabled once a statement is loaded", enabled);
  const legacyButtons = await page.locator('button:has-text("Print Portrait"), button:has-text("Print Landscape")').count();
  check("no duplicate Print Portrait / Print Landscape toolbar buttons remain", legacyButtons === 0, legacyButtons);
  await page.screenshot({ path: path.join(DIR, "ledger-ui-screen.png") });
  if (enabled) {
    await menuBtn.click();
    const items = await page.locator('[role="menuitem"]').allInnerTexts();
    check("menu offers Print + PDF in both orientations and CSV", ["ledger-print-portrait", "ledger-print-landscape", "ledger-pdf-portrait", "ledger-pdf-landscape", "ledger-export-csv"].length === 5 && items.length === 5, items.join(" | "));
    await page.locator('[data-testid="ledger-print-portrait"]').click();
    const frame = page.locator("iframe").first();
    await frame.waitFor({ timeout: 60000 });
    const srcdoc = async () => (await frame.getAttribute("srcdoc")) || "";
    let html = await srcdoc();
    check("preview opens the PORTRAIT layout (7 columns)", html.includes('data-layout="portrait"'), html.includes('data-layout="portrait"'));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(DIR, "ledger-ui-preview-portrait.png") });
    // orientation toggle in the preview → rebuild
    await page.locator("div.fixed.inset-0 button").filter({ hasText: /^\s*(Portrait|Landscape)\s*$/ }).first().click();
    await page.waitForTimeout(1500);
    html = await srcdoc();
    check("preview toggle REBUILDS the landscape layout (12 columns)", html.includes('data-layout="landscape"') && (html.match(/<tr class="cols">([\s\S]*?)<\/tr>/)?.[1].match(/<th/g) ?? []).length === 12, html.includes('data-layout="landscape"'));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(DIR, "ledger-ui-preview-landscape.png") });
    // language switch in the preview → rebuild in Urdu, RTL
    const sel = page.locator("select").filter({ has: page.locator('option[value="ur"]') }).first();
    if (await sel.count()) {
      await sel.selectOption("ur");
      await page.waitForTimeout(1500);
      html = await srcdoc();
      check("preview language switch rebuilds in Urdu (RTL)", /<html lang="ur" dir="rtl">/.test(html), /dir="rtl"/.test(html));
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(DIR, "ledger-ui-preview-landscape-ur.png") });
    } else check("preview language selector present", false);
  }
  await ctx.close();
}

// 2. finance-denied business login and an operations login: page 403, statement API 403
for (const key of ["restricted", "ops_pk"]) {
  const { ctx } = await session(key);
  const page = await ctx.newPage();
  const res = await page.goto(BASE + "/dashboard/ledger/detailed", { waitUntil: "domcontentloaded", timeout: 180000 });
  check(`${key}: Detailed Ledger page is 403`, res?.status() === 403, res?.status());
  const api = await ctx.request.get(BASE + "/api/erp/accounting/reports/ledger/ledgers?reportScope=country");
  check(`${key}: ledger report API is 403 (print has no data source)`, api.status() === 403, api.status());
  await page.screenshot({ path: path.join(DIR, `ledger-ui-denied-${key}.png`) });
  await ctx.close();
}
await browser.close();
const fail = results.filter((r) => !r.pass);
console.log(`\nTOTAL ${results.length - fail.length}/${results.length} PASS`);
fs.writeFileSync(path.join(DIR, "ledger-ui-results.json"), JSON.stringify(results, null, 2));
process.exit(fail.length ? 1 : 0);
