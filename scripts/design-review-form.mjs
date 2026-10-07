// DEV-only, read-only responsive review of ONE original ERP form: phones + tablets in both orientations,
// Light + Dark themes, all five languages. Real login (DEV test user). Every wizard step is opened through the
// form's own step headers; the first dropdown of each step is opened to check it fits on screen; an optional
// print button is clicked to check the print preview still opens on the A4 paper layout.
// NOTHING IS SAVED: the script only clicks step headers / dropdowns / print and takes screenshots.
// Env: BASE, RBAC_SECRET, OUT, FORM_PATH, FORM_KEY, STEP_SELECTOR?, PRINT_SELECTOR?, LANGS, THEMES, DEVICES, SHOTS (all|first)
import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT;
const FORM_PATH = process.env.FORM_PATH;
const FORM_KEY = process.env.FORM_KEY || "form";
const STEP_SELECTOR = process.env.STEP_SELECTOR || "";
const PRINT_SELECTOR = process.env.PRINT_SELECTOR || "";
const LANGS = (process.env.LANGS || "en,ur,ar,fa,ps").split(",");
const THEMES = (process.env.THEMES || "day,night").split(",");
const SHOTS = process.env.SHOTS || "all";
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
  const fields = controls.filter((el) => el.matches("input:not([type=checkbox]):not([type=radio]), select, textarea")).length;
  return { theme: de.dataset.erpThemeMode, dark: de.classList.contains("dark"), dir: de.dir, lang: de.lang, pageOverflowX: de.scrollWidth > vw + 1, controls: controls.length, fields, clipped };
});
// open the first dropdown / combobox of the visible step and check its popup is fully on screen
const checkDropdown = async (page) => {
  const trigger = page.locator("[data-erp-content] [role=combobox]:visible, [data-erp-content] button[aria-haspopup]:visible, [data-erp-content] select:visible").first();
  if (!(await trigger.count())) return { dropdown: "none" };
  const tag = await trigger.evaluate((e) => e.tagName);
  if (tag === "SELECT") return { dropdown: "native-select" };
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await trigger.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  const popup = await page.evaluate(() => {
    const el = document.querySelector("[role=listbox], [role=dialog][data-state=open], [data-radix-popper-content-wrapper], [cmdk-root]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), inside: r.left >= -1 && r.right <= window.innerWidth + 1 && r.width > 0 };
  });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(250);
  return popup ? { dropdown: popup.inside ? "fits" : "OFF-SCREEN", popupW: popup.w } : { dropdown: "no-popup" };
};

const browser = await chromium.launch();
const report = [];
for (const theme of THEMES) for (const lang of LANGS) for (const d of DEVICES) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, isMobile: d.mobile, hasTouch: d.mobile, deviceScaleFactor: 1 });
  await ctx.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: lang, domain: "localhost", path: "/" },
    { name: "erp_theme_mode", value: theme, domain: "localhost", path: "/" },
  ]);
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); } catch {} }, [theme, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  const r = await page.goto(BASE + FORM_PATH, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const stepButtons = STEP_SELECTOR ? await page.locator(STEP_SELECTOR).count() : 0;
  const steps = Math.max(1, stepButtons);
  for (let i = 0; i < steps; i++) {
    if (stepButtons) { await page.locator(STEP_SELECTOR).nth(i).click(); await page.waitForTimeout(600); }
    const m = await measure(page);
    const dd = await checkDropdown(page);
    const shoot = SHOTS === "all" || (lang === "en" || lang === "ur");
    const file = `${FORM_KEY}-${theme}-${lang}-${d.key}-step${i + 1}.png`;
    if (shoot) await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
    report.push({ theme, lang, device: d.key, step: i + 1, status: r?.status(), file: shoot ? file : null, ...m, ...dd, errors: errors.splice(0) });
    console.log(theme, lang, d.key, "step" + (i + 1), r?.status(), (m.dark ? "dark" : "light"), m.dir, "overflowX=" + m.pageOverflowX, "fields=" + m.fields, "clipped=" + JSON.stringify(m.clipped), "dropdown=" + dd.dropdown);
  }
  if (PRINT_SELECTOR && lang === LANGS[0] && theme === THEMES[0] && ["iphone15", "ipad-portrait"].includes(d.key)) {
    const popupP = page.waitForEvent("popup", { timeout: 20000 }).catch(() => null);
    await page.locator(PRINT_SELECTOR).first().click({ timeout: 5000 }).catch(() => {});
    const pop = await popupP;
    if (pop) {
      await pop.waitForLoadState("domcontentloaded").catch(() => {});
      await pop.waitForTimeout(1200);
      const paper = await pop.evaluate(() => ({ title: document.title, pageRule: [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.type === 6 || /@page/.test(r.cssText)); } catch { return false; } }), bodyText: document.body.innerText.length }));
      await pop.screenshot({ path: `${OUT}/${FORM_KEY}-print-${d.key}.png`, fullPage: false });
      report.push({ print: true, device: d.key, ...paper });
      console.log("print", d.key, JSON.stringify(paper));
      await pop.close();
    } else {
      const modal = await page.locator("[role=dialog]:visible").count();
      report.push({ print: true, device: d.key, popup: false, modal });
      console.log("print", d.key, "no popup; dialogs visible:", modal);
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const rows = report.filter((x) => !x.print);
const bad = rows.filter((x) => x.status !== 200 || x.pageOverflowX || x.clipped.length || x.errors.length || x.theme !== x.theme || x.dropdown === "OFF-SCREEN" || (x.dark !== (x.theme === "night")) || x.lang.slice(0, 2) !== x.lang.slice(0, 2));
console.log(`\nRESULT ${rows.length - bad.length}/${rows.length} clean`);
for (const b of bad.slice(0, 20)) console.log("ISSUE", JSON.stringify(b));
