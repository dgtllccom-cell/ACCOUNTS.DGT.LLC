// DEV-only, read-only design review of ONE original ERP form across devices / orientations / languages.
// Real login (DEV test user), Studio theme, every wizard step opened through the form's own step headers.
// Nothing is saved: the script only clicks step headers / tabs and takes screenshots.
// Env: BASE, RBAC_SECRET (DEV test-user secret file), OUT, FORM_PATH, FORM_KEY, STEP_SELECTOR (optional), LANGS, DEVICES
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT;
const FORM_PATH = process.env.FORM_PATH;
const FORM_KEY = process.env.FORM_KEY || "form";
const STEP_SELECTOR = process.env.STEP_SELECTOR || "";
const LANGS = (process.env.LANGS || "en,ur").split(",");
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const ALL_DEVICES = [
  { key: "iphone15", w: 390, h: 844, mobile: true },
  { key: "iphone-promax", w: 430, h: 932, mobile: true },
  { key: "samsung-s", w: 412, h: 915, mobile: true },
  { key: "huawei-p", w: 360, h: 780, mobile: true },
  { key: "phone-landscape", w: 844, h: 390, mobile: true },
  { key: "ipad-portrait", w: 820, h: 1180, mobile: true },
  { key: "ipad-landscape", w: 1180, h: 820, mobile: true },
  { key: "android-tab-portrait", w: 800, h: 1280, mobile: true },
  { key: "android-tab-landscape", w: 1280, h: 800, mobile: true },
  { key: "desktop", w: 1440, h: 900, mobile: false },
];
const DEVICES = process.env.DEVICES ? ALL_DEVICES.filter((d) => process.env.DEVICES.split(",").includes(d.key)) : ALL_DEVICES;

const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="))?.slice("erp_session=".length);
if (!token) throw new Error("login failed " + res.status);

const measure = (page) => page.evaluate(() => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
  const controls = [...document.querySelectorAll("[data-erp-content] input:not([type=hidden]), [data-erp-content] select, [data-erp-content] textarea, [data-erp-content] button")].filter(visible);
  const clipped = controls.filter((el) => { if (inScroller(el)) return false; const r = el.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; })
    .map((el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.tagName).trim().slice(0, 40));
  const small = controls.filter((el) => el.matches("input, select") && el.getBoundingClientRect().height < 36).length;
  return { theme: de.dataset.erpThemeMode, dir: de.dir, pageOverflowX: de.scrollWidth > vw + 1, controls: controls.length, clipped, smallInputs: small };
});

const browser = await chromium.launch();
const report = [];
for (const lang of LANGS) for (const d of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: d.mobile, hasTouch: d.mobile, deviceScaleFactor: 1 });
  await ctx.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: lang, domain: "localhost", path: "/" },
    { name: "erp_theme_mode", value: "studio", domain: "localhost", path: "/" },
  ]);
  await ctx.addInitScript((l) => { try { localStorage.setItem("erp_theme_mode", "studio"); localStorage.setItem("erp_lang", l); } catch {} }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  const r = await page.goto(BASE + FORM_PATH, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // dismiss the PWA install banner so it does not cover the form
  await page.locator("button:has-text('×'), button[aria-label='Dismiss']").first().click({ timeout: 1500 }).catch(() => {});
  const stepButtons = STEP_SELECTOR ? await page.locator(STEP_SELECTOR).count() : 0;
  const steps = Math.max(1, stepButtons);
  for (let i = 0; i < steps; i++) {
    if (stepButtons) { await page.locator(STEP_SELECTOR).nth(i).click(); await page.waitForTimeout(700); }
    const m = await measure(page);
    const file = `${FORM_KEY}-${lang}-${d.key}-step${i + 1}.png`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    report.push({ lang, device: d.key, step: i + 1, status: r?.status(), file, ...m, errors: errors.splice(0) });
    console.log(lang, d.key, "step" + (i + 1), r?.status(), m.theme, m.dir, "overflowX=" + m.pageOverflowX, "controls=" + m.controls, "clipped=" + JSON.stringify(m.clipped), "small=" + m.smallInputs);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const bad = report.filter((x) => x.status !== 200 || x.pageOverflowX || x.clipped.length || x.errors.length || x.theme !== "studio");
console.log(`\nRESULT ${report.length - bad.length}/${report.length} clean`);
