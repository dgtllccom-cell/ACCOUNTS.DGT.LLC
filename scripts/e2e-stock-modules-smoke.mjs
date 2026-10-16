/**
 * DEV ONLY — every related ERP page (Stock Journal, Purchase, Local Purchase, Loading, Sales, Inventory, Journals, Ledgers, Reports) opens
 * with no error boundary, no page error and no 5xx API response, in the chosen languages.
 *   BASE=http://localhost:3400 LANGS=en,ur DEVICE=desktop node scripts/e2e-stock-modules-smoke.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3400";
if (!/localhost/.test(BASE)) throw new Error("DEV only");
const LANGS = (process.env.LANGS || "en").split(",");
const DEVICE = process.env.DEVICE || "desktop";
const OUT = (process.env.OUT || "out/smoke") + "/" + DEVICE;
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = { desktop: { w: 1440, h: 900, dpr: 1, mobile: false }, ipad: { w: 820, h: 1180, dpr: 2, mobile: true }, iphone: { w: 390, h: 844, dpr: 3, mobile: true } };
const D = DEVICES[DEVICE];
const PAGES = (process.env.PAGES ? process.env.PAGES.split(",") : [
  "/dashboard/purchase/stock/journal", "/dashboard/purchase/stock/loading", "/dashboard/purchase/stock/confirmed", "/dashboard/purchase/stock/warehouse",
  "/dashboard/purchase/stock/export", "/dashboard/purchase/stock/local-market", "/dashboard/purchase/stock/transfer", "/dashboard/purchase/stock/history",
  "/dashboard/purchase/stock/booking", "/dashboard/inventory/journal-stock", "/dashboard/purchase/journal-booking-stock",
  "/dashboard/inventory", "/dashboard/inventory/stock-reports", "/dashboard/inventory/stock-reports/branch", "/dashboard/inventory/stock-reports/country", "/dashboard/inventory/stock-reports/salesman", "/dashboard/inventory/journal-report/branch",
  "/dashboard/purchase/new-purchase-booking-order", "/dashboard/purchase/purchase-order", "/dashboard/purchase/purchase-loading-records", "/dashboard/purchase/purchase-confirm",
  "/dashboard/purchase/purchase-order-tracking", "/dashboard/purchase/purchase-booking-journal-report", "/dashboard/purchase/completed-purchase-bills", "/dashboard/purchase/country-purchase-reports",
  "/dashboard/purchase/local-purchase", "/dashboard/purchase/local-purchase-journal-report", "/dashboard/purchase/local-purchase-transfer-payment", "/dashboard/purchase/purchase-payments", "/dashboard/purchase/shipment-tracking",
  "/dashboard/sales/new-sales-booking-order", "/dashboard/sales/sales-order", "/dashboard/sales/sales-confirm", "/dashboard/sales/local-sales", "/dashboard/sales/sales-booking-journal-report",
  "/dashboard/journal/purchase-order-payment/history", "/dashboard/journal/purchase-order-payment/remaining", "/dashboard/journal/sales-order-payment/history", "/dashboard/journal/sales-order-payment/remaining",
  "/dashboard/ledgers", "/dashboard/reports/payments", "/dashboard/roznamcha/reports/all",
]);

const r0 = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const cookie = (r0.headers.getSetCookie() || []).map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();
let pass = 0, fail = 0;
for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile });
  await ctx.addCookies([{ name: "erp_session", value: cookie, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, lang);
  for (const path of PAGES) {
    const p = await ctx.newPage();
    const problems = [];
    p.on("pageerror", (e) => problems.push("pageerror: " + String(e).slice(0, 140)));
    p.on("response", (r) => { const u = new URL(r.url()); if (r.status() >= 500 && u.pathname.startsWith("/api/")) problems.push(`API ${r.status()} ${u.pathname}`); });
    let status = 0;
    try {
      const resp = await p.goto(BASE + path, { waitUntil: "load", timeout: 240000 });
      status = resp?.status() ?? 0;
      await p.waitForTimeout(Number(process.env.SETTLE || 4000));
      const body = await p.evaluate(() => document.body.innerText || "");
      if (status >= 500) problems.push("HTTP " + status);
      if (/Application error|Something went wrong|ERR-ROOT|Unhandled Runtime Error|This page could not be found/i.test(body)) problems.push("error boundary / 404 text: " + (body.match(/Application error|Something went wrong|ERR-ROOT|Unhandled Runtime Error|This page could not be found/i) || [""])[0]);
      if (body.trim().length < 80) problems.push("page is blank");
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (overflow) problems.push("horizontal page overflow");
      if (path === "/dashboard/purchase/stock/journal" || lang !== "en") await p.screenshot({ path: `${OUT}/${lang}-${path.replace(/[^a-z0-9]+/gi, "_")}.png` }).catch(() => {});
    } catch (e) { problems.push("load failed: " + String(e).slice(0, 120)); }
    (problems.length ? fail++ : pass++);
    console.log(`${problems.length ? "FAIL" : "PASS"} [${lang}/${DEVICE}] ${path}${problems.length ? " · " + problems.join(" | ") : ""}`);
    await p.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
