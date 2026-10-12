/**
 * Authenticated browser screenshots of the five approved Purchase pages (DEV only).
 *   [ROLE=country_admin COUNTRY_ID=<uuid>] BASE=http://localhost:3000 OUT=<dir> PAGES=booking,payments,... LANGS=en,ur DEVICES=desktop,iphone,samsung,ipad THEMES=light,dark node scripts/dev/purchase-ui-shots.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const PAGES = {
  booking: "/dashboard/purchase/purchase-booking-journal-report",
  payments: "/dashboard/purchase/purchase-payments",
  orders: "/dashboard/purchase/purchase-order",
  country: "/dashboard/purchase/completed-purchase-bills",
  loading: "/dashboard/purchase/purchase-loading-records",
  p_advance: "/dashboard/journal/purchase-order-payment/advance",
  p_endorsement: "/dashboard/journal/purchase-order-payment/endorsement",
  p_credit: "/dashboard/journal/purchase-order-payment/charges",
  p_remaining: "/dashboard/journal/purchase-order-payment/remaining",
  p_history: "/dashboard/journal/purchase-order-payment/history",
  p_final: "/dashboard/journal/purchase-order-payment/final",
  s_advance: "/dashboard/journal/sales-order-payment/advance",
  s_credit: "/dashboard/journal/sales-order-payment/charges",
  s_remaining: "/dashboard/journal/sales-order-payment/remaining",
  s_history: "/dashboard/journal/sales-order-payment/history",
  journalrem: "/dashboard/journal/purchase-order-payment/remaining", // NOT one of the five approved pages: must keep its original layout
};
const DEVICES = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  laptop: { w: 1366, h: 768, dpr: 1, mobile: false },
  ipad: { w: 820, h: 1180, dpr: 2, mobile: true },
  tablet: { w: 768, h: 1024, dpr: 2, mobile: true },
  samsung: { w: 412, h: 915, dpr: 2.6, mobile: true },
  iphone: { w: 390, h: 844, dpr: 3, mobile: true },
  iphonese: { w: 320, h: 568, dpr: 2, mobile: true },
};
const pick = (env, all) => (process.env[env] ? process.env[env].split(",") : all);
const pages = pick("PAGES", ["booking", "payments", "orders", "country", "loading"]);
const langs = pick("LANGS", ["en"]);
const devices = pick("DEVICES", ["desktop"]);
const themes = pick("THEMES", ["light"]);
const FULL = process.env.FULL === "1";

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: process.env.ROLE || "super_admin", countryId: process.env.COUNTRY_ID || undefined }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();
const summary = [];
for (const dev of devices) {
  const D = DEVICES[dev];
  for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: D.mobile, hasTouch: D.mobile, colorScheme: theme });
    for (const lang of langs) {
      await ctx.clearCookies();
      await ctx.addCookies([{ name: "erp_session", value: token, domain: new URL(BASE).hostname, path: "/" }, { name: "erp_lang", value: lang, domain: new URL(BASE).hostname, path: "/" }]);
      await ctx.addInitScript(([l, t]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); localStorage.setItem("theme", t); } catch {} }, [lang, theme]);
      for (const p of pages) {
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
        try {
          await page.goto(BASE + PAGES[p], { waitUntil: "load", timeout: 180000 });
          await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
          await page.addStyleTag({ content: "[data-dgt-connect]{display:none!important}" }).catch(() => {});
          if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark")).catch(() => {});
          await page.waitForTimeout(Number(process.env.SETTLE || 5000));
          // slow dev API: wait (max 30s) until the register has rows (or the page settles with none)
          await page.waitForFunction(() => document.querySelectorAll("tbody tr").length > 2 && !/Loading/i.test(document.querySelector("main, [data-erp-content]")?.innerText || ""), null, { timeout: 30000 }).catch(() => {});
          // approved header fully loaded: summary has figures and no payment-type row is still "—" (data still loading)
          const loaded = await page.waitForFunction(() => { const c = [...document.querySelectorAll(".dgt-pa-card")]; return c.length === 3 && /\d{2,}/.test(c[0].innerText) && !/(^|\n)—(\n|$)/.test(c[1].innerText); }, null, { timeout: Number(process.env.HEADER_WAIT || 45000) }).then(() => true).catch(() => false);
          await page.waitForTimeout(1500);
          const file = `${OUT}/${p}-${dev}-${lang}-${theme}.png`;
          await page.screenshot({ path: file, fullPage: FULL });
          const m = await page.evaluate(() => ({ dir: document.documentElement.dir, overflowX: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelector("h1,h2")?.textContent?.trim().slice(0, 60) }));
          summary.push({ p, dev, lang, theme, ...m, headerLoaded: loaded, errors: errors.length });
          console.log("ok", p, dev, lang, theme, "loaded=" + loaded, JSON.stringify(m), errors.length ? "ERR " + errors[0] : "");
        } catch (e) { console.log("FAIL", p, dev, lang, theme, String(e).slice(0, 100)); }
        await page.close();
      }
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
