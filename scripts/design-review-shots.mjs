// DEV-only design review: real login (DEV Global SA test user), original ERP forms, Studio theme vs current theme,
// phone / tablet / desktop in portrait + landscape, EN + one RTL language. Writes PNGs + report.json to OUT.
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT;
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SECRET_FILE = process.env.RBAC_SECRET;
const { password } = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const FORMS = [
  { key: "cash-entry", path: "/dashboard/roznamcha/cash-entry" },
  { key: "purchase-booking", path: "/dashboard/purchase/new-purchase-booking-order" },
  { key: "new-account", path: "/dashboard/accounts/setup" },
  { key: "po-advance", path: "/dashboard/journal/purchase-order-payment/advance" },
  { key: "po-charges", path: "/dashboard/journal/purchase-order-payment/charges" },
  { key: "dashboard", path: "/dashboard" },
];
const VIEWS = [
  { key: "iphone", w: 390, h: 844, mobile: true },
  { key: "samsung", w: 412, h: 915, mobile: true },
  { key: "iphone-land", w: 844, h: 390, mobile: true },
  { key: "ipad", w: 820, h: 1180, mobile: true },
  { key: "ipad-land", w: 1180, h: 820, mobile: true },
  { key: "desktop", w: 1440, h: 900, mobile: false },
];
const THEMES = (process.env.THEMES || "studio").split(",");
const LANGS = (process.env.LANGS || "en,ur").split(",");

const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="))?.slice("erp_session=".length);
if (!token) throw new Error("login failed " + res.status);

const browser = await chromium.launch();
const report = [];
for (const theme of THEMES) for (const lang of LANGS) for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, isMobile: v.mobile, hasTouch: v.mobile, deviceScaleFactor: 1 });
  const host = new URL(BASE).hostname;
  await ctx.addCookies([
    { name: "erp_session", value: token, domain: host, path: "/" },
    { name: "erp_lang", value: lang, domain: host, path: "/" },
    { name: "erp_theme_mode", value: theme, domain: host, path: "/" },
  ]);
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); localStorage.setItem("pwa-install-dismissed", "1"); } catch {} }, [theme, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  for (const f of FORMS) {
    if (ONLY && !ONLY.includes(f.key)) continue;
    let status = 0;
    try {
      const r = await page.goto(BASE + f.path, { waitUntil: "domcontentloaded", timeout: 180000 });
      status = r?.status() ?? 0;
      await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
    } catch (e) { errors.push("nav " + String(e).slice(0, 120)); }
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const content = document.querySelector("[data-erp-content]");
      const vw = window.innerWidth;
      const clipped = [...document.querySelectorAll("[data-erp-content] input, [data-erp-content] select, [data-erp-content] textarea, [data-erp-content] button")]
        .filter((el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; if (el.closest("table") || el.closest("[class*='overflow-x']")) return false; return r.right > vw + 1 || r.left < -1; }).length;
      const fields = document.querySelectorAll("[data-erp-content] input:not([type=hidden]), [data-erp-content] select, [data-erp-content] textarea").length;
      return { theme: de.dataset.erpThemeMode, dir: de.dir, pageOverflowX: de.scrollWidth > vw + 1, scrollW: de.scrollWidth, vw, clipped, fields, hasContent: Boolean(content), bodyBg: getComputedStyle(document.body).backgroundColor };
    });
    const file = `${theme}-${lang}-${v.key}-${f.key}.png`;
    await page.screenshot({ path: OUT + "/" + file, fullPage: false });
    report.push({ theme, lang, view: v.key, form: f.key, status, ...m, errors: errors.splice(0) });
    console.log(theme, lang, v.key, f.key, status, m.theme, m.dir, "overflowX=" + m.pageOverflowX, "clipped=" + m.clipped, "fields=" + m.fields);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 2));
