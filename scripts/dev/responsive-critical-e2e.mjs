/**
 * DEV only — critical business screens at desktop (1440), tablet (820) and phone (390): page renders, no page errors,
 * no sideways page scroll. BASE=http://localhost:3520 OUT=<dir> node scripts/dev/responsive-critical-e2e.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3520";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT || ".ui-out/responsive"; fs.mkdirSync(OUT, { recursive: true });
const PAGES = ["dashboard", "dashboard/purchase/local-purchase-journal-report", "dashboard/sales/sales-order", "dashboard/clearing-agent/customer-order", "dashboard/clearing-agent/customer-bill", "dashboard/roznamcha/money-exchange", "dashboard/expenses/bill-expenses", "dashboard/shipping-line", "dashboard/logistics"];
const WIDTHS = [1440, 820, 390];
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 160) : ""); };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
  await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
  for (const path of PAGES) {
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    const tag = `${path} [${w}px]`;
    try {
      await p.goto(`${BASE}/${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
      await p.waitForFunction(() => !document.querySelector(".animate-spin") && document.body.innerText.length > 200, null, { timeout: 90000 }).catch(() => {});
      await p.waitForTimeout(1200);
      const info = await p.evaluate(() => ({ len: document.body.innerText.length, overflow: document.documentElement.scrollWidth - innerWidth, boundary: /Something went wrong|Application error/i.test(document.body.innerText) }));
      check(tag, info.len > 300 && !info.boundary && errs.length === 0 && info.overflow <= 2, `len=${info.len} overflow=${info.overflow} errs=${errs.length}`);
      if (w === 390) await p.screenshot({ path: `${OUT}/${path.replace(/\W+/g, "_")}-390.png` }).catch(() => {});
    } catch (e) { check(tag, false, String(e).slice(0, 100)); }
    await p.close();
  }
  await ctx.close();
}
await b.close();
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
