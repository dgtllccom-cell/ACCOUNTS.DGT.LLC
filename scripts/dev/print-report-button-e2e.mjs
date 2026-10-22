/**
 * DEV only — the Print Report button on the Bill Expenses and Bill Cost & Profit pages produces a printable document
 * (opens a print view with content and a real PDF). BASE=http://localhost:3520 OUT=<dir> node scripts/dev/print-report-button-e2e.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/print-button"; fs.mkdirSync(OUT, { recursive: true });
const PAGES = ["dashboard/expenses/bill-expenses", "dashboard/bill-cost-profit"];
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 160) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
for (const path of PAGES) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const btn = p.getByRole("button", { name: /Print Report/i }).first();
  const exists = await btn.count();
  check(`${path}: Print Report button present`, exists > 0);
  if (exists > 0) {
    const popupPromise = ctx.waitForEvent("page", { timeout: 60000 }).catch(() => null);
    await btn.click().catch(() => {});
    const pop = await popupPromise;
    if (pop) {
      await pop.waitForLoadState("domcontentloaded", { timeout: 90000 }).catch(() => {});
      await pop.waitForTimeout(1500);
      const text = await pop.evaluate(() => document.body.innerText || "");
      const pdf = await pop.pdf({ format: "A4", printBackground: true, landscape: true }).catch(() => null);
      const bytes = pdf ? pdf.length : 0;
      check(`${path}: print view has report content`, text.length > 200, `len=${text.length}`);
      check(`${path}: print view produces a real PDF`, bytes > 4000, `${(bytes / 1024) | 0}KB`);
      if (pdf) fs.writeFileSync(`${OUT}/${path.replace(/\W+/g, "_")}.pdf`, pdf);
      await pop.close();
    } else {
      check(`${path}: Print Report opens a print view`, false, "no new page opened");
    }
  }
  await p.close();
}
await b.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
