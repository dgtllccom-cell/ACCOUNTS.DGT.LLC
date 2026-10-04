// DEV-only, read-only: one page in iPhone Safari's engine (WebKit) on phones / tablets, before vs after the mobile
// template. "before" deletes the template's rules at runtime (= the current Production look); "after" is the DEV
// preview. Country / branch sections render expanded by default; page tabs are switched by position
// (TAB_SELECTOR + TAB_INDEXES, language independent). Saves nothing.
// Env: BASE, RBAC_SECRET, OUT, PAGE_PATH, KEY, LANGS, THEMES, MODES, DEVICES, TAB_SELECTOR, TAB_INDEXES, SEGMENTS
import fs from "node:fs";
import { webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const PAGE_PATH = process.env.PAGE_PATH;
const KEY = process.env.KEY || "page";
const LANGS = (process.env.LANGS || "en,ur").split(",");
const THEMES = (process.env.THEMES || "day").split(",");
const MODES = (process.env.MODES || "before,after").split(",");
const TAB_SELECTOR = process.env.TAB_SELECTOR || "";
const TAB_INDEXES = process.env.TAB_INDEXES ? process.env.TAB_INDEXES.split(",").map(Number) : [];
const SEGMENTS = Number(process.env.SEGMENTS || 4);
const ALL_DEVICES = [
  { key: "iphone17promax", w: 440, h: 956, dpr: 3, phone: true },
  { key: "iphone17promax-land", w: 956, h: 440, dpr: 3, phone: true },
  { key: "iphone15", w: 393, h: 852, dpr: 3, phone: true },
  { key: "samsung-s", w: 412, h: 915, dpr: 3, phone: true },
  { key: "huawei-p", w: 360, h: 780, dpr: 3, phone: true },
  { key: "ipad-portrait", w: 820, h: 1180, dpr: 2 },
  { key: "ipad-landscape", w: 1180, h: 820, dpr: 2 },
  { key: "android-tab-portrait", w: 800, h: 1280, dpr: 2 },
  { key: "android-tab-landscape", w: 1280, h: 800, dpr: 2 },
];
const DEVICES = ALL_DEVICES.filter((d) => (process.env.DEVICES || "iphone17promax").split(",").includes(d.key));
const UA_PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const UA_TABLET = "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = (res.headers.getSetCookie() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

const stripTemplate = () => {
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (let i = rules.length - 1; i >= 0; i--) {
      if (rules[i].cssText.includes('data-erp-theme-mode="system"]:not(.dark)') || (rules[i].media && /1023\.98px|639\.98px|1399\.98px/.test(rules[i].media.mediaText))) sheet.deleteRule(i);
    }
  }
};
const measure = () => {
  const vw = innerWidth;
  const de = document.documentElement;
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return p; } return null; };
  const clippedText = [...document.querySelectorAll("[data-erp-content] h2, [data-erp-content] h3, [data-erp-content] span, [data-erp-content] p, [data-erp-content] button, [data-erp-content] a")]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && !inScroller(el) && (r.right > vw + 1 || r.left < -1); })
    .map((el) => el.textContent.trim().slice(0, 30));
  // narrow vertical stacks: a heading / badge squeezed below 90px wide and taller than 3 lines
  const stacks = [...document.querySelectorAll("[data-erp-content] h2, [data-erp-content] h3, [data-erp-content] span.font-bold, [data-erp-content] span.font-mono")]
    .filter((el) => { const r = el.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(el).lineHeight) || 16; return r.width > 0 && r.width < 90 && r.height > lh * 3; })
    .map((el) => el.textContent.trim().slice(0, 30));
  const scrollers = [...document.querySelectorAll("[data-erp-content] table")].map((t) => { const s = inScroller(t); return s ? (s.scrollWidth > s.clientWidth ? "scrolls" : "fits") : "NO-SCROLLER"; });
  const nav = document.querySelector("nav.fixed.bottom-0");
  const fab = document.querySelector("button[aria-label='Open chat']");
  let fabOverNav = false;
  if (nav && fab && getComputedStyle(nav).display !== "none") { const a = nav.getBoundingClientRect(), b = fab.getBoundingClientRect(); fabOverNav = !(b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right); }
  return { theme: de.dataset.erpThemeMode, dark: de.classList.contains("dark"), dir: de.dir, overflowX: de.scrollWidth > vw + 1, clippedText, stacks, tables: scrollers.length, tablesWithoutScroller: scrollers.filter((x) => x === "NO-SCROLLER").length, fabOverNav, pageHeight: de.scrollHeight };
};

const browser = await webkit.launch();
const report = [];
for (const DEVICE of DEVICES) for (const mode of MODES) for (const theme of THEMES) for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width: DEVICE.w, height: DEVICE.h }, deviceScaleFactor: DEVICE.dpr, isMobile: true, hasTouch: true, userAgent: DEVICE.phone ? UA_PHONE : UA_TABLET });
  await ctx.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: lang, domain: "localhost", path: "/" },
    { name: "erp_theme_mode", value: theme, domain: "localhost", path: "/" },
  ]);
  await ctx.addInitScript(([t, l]) => { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); }, [theme, lang]);
  const page = await ctx.newPage();
  await page.goto(BASE + PAGE_PATH, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(1500);
  if (mode === "before") await page.evaluate(stripTemplate);
  const views = [{ name: "default" }, ...TAB_INDEXES.map((i) => ({ name: "tab" + i, tab: i }))];
  for (const v of views) {
    if (v.tab !== undefined) { await page.locator(TAB_SELECTOR).nth(v.tab).click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(900); }
    const m = await page.evaluate(measure);
    const base = `${KEY}-${DEVICE.key}-${mode}-${theme}-${lang}-${v.name}`;
    // screen-by-screen segments (a full-page capture of a very tall page exceeds WebKit's 32767px limit at 3x)
    const segs = Math.min(SEGMENTS, Math.ceil(m.pageHeight / DEVICE.h));
    for (let i = 0; i < segs; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * (DEVICE.h - 120));
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/${base}-s${i + 1}.png` });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    report.push({ device: DEVICE.key, mode, theme, lang, view: v.name, file: base, ...m });
    console.log(DEVICE.key, mode, theme, lang, v.name, JSON.stringify({ ...m, clippedText: m.clippedText.length ? m.clippedText : 0 }));
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const after = report.filter((r) => r.mode === "after");
const bad = after.filter((r) => r.overflowX || r.clippedText.length || r.stacks.length || r.tablesWithoutScroller || r.fabOverNav || (r.dark !== (r.theme === "night")));
console.log(`\nAFTER RESULT ${after.length - bad.length}/${after.length} clean`);
for (const b of bad.slice(0, 15)) console.log("ISSUE", b.device, b.theme, b.lang, b.view, JSON.stringify({ clipped: b.clippedText, stacks: b.stacks, fab: b.fabOverNav, ox: b.overflowX }));
