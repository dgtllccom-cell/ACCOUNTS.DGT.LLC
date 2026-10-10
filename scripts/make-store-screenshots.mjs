/**
 * Store screenshots for DGT.llc B and DGT.llc BS — real screens of the ERP on a DEV server (never Production), exact store pixel sizes.
 *   BASE=http://localhost:3250 node scripts/make-store-screenshots.mjs [lang]      (DEV server with ALLOW_DEV_SESSION=true)
 * Output: docs/store/screenshots/<app>/<size>/<n>-<name>.png
 */
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3250";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("DEV only");
const LANG = process.argv[2] || "en";
const SIZES = {
  "play-phone-1080x1920": { w: 360, h: 640, dpr: 3, mobile: true },
  "iphone-6.9in-1320x2868": { w: 440, h: 956, dpr: 3, mobile: true },
  "ipad-13in-2064x2752": { w: 1032, h: 1376, dpr: 2, mobile: true },
};
const APPS = {
  b: [
    ["dashboard", "/dashboard/super-admin"],
    ["accounts", "/dashboard/accounts/setup"],
    ["purchase-booking", "/dashboard/purchase/new-purchase-booking"],
    ["stock", "/dashboard/stock"],
    ["reports", "/dashboard/reports"],
  ],
  bs: [
    ["shipment-tracking", "/dashboard/shipping-line/tracking"],
    ["bl-entry", "/dashboard/shipping-line/bl-entry"],
    ["clearing-workspace", "/dashboard/clearing-agent/clearing-workspace"],
    ["customer-orders", "/dashboard/clearing-agent/customer-order"],
    ["tracking-reports", "/dashboard/shipping-line/shipment-report"],
  ],
};
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const browser = await chromium.launch();
for (const [size, S] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: S.dpr, isMobile: S.mobile, hasTouch: true });
  await ctx.addCookies([
    { name: "erp_session", value: token, domain: new URL(BASE).hostname, path: "/" },
    { name: "erp_lang", value: LANG, domain: new URL(BASE).hostname, path: "/" },
  ]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, LANG);
  for (const [app, pages] of Object.entries(APPS)) {
    const dir = `docs/store/screenshots/${LANG === "en" ? "" : LANG + "/"}${app}/${size}`;
    fs.mkdirSync(dir, { recursive: true });
    let n = 1;
    for (const [name, route] of pages) {
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
        await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
        for (let i = 0; i < 20; i++) { const spin = await page.evaluate(() => !![...document.querySelectorAll("[data-erp-content] .animate-spin")].find((e) => e.getBoundingClientRect().width > 14)).catch(() => false); if (!spin) break; await page.waitForTimeout(2000); }
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${dir}/${n}-${name}.png` });
        console.log("ok", dir, name);
        n++;
      } catch (e) { console.log("FAILED", app, size, name, String(e).slice(0, 80)); }
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();
