// Mobile + tablet sweep of every menu route using a DEV dev-session login (no stored password). Derived from design-sweep2.mjs.
// DEV-only, read-only FULL-MATRIX responsive sweep (iPhone Safari's engine = WebKit). Saves nothing in the ERP.
// Every route x all 5 languages (en, ur, ar, fa, ps) x 3 themes (Light, Dark, System[OS dark]) x 14 sizes (6 phones, 4 tablets, 4 laptops/desktops).
// Efficiency (no sampling): one page load per (route, language, theme, device class); the 6 phone sizes (and the 4 tablet sizes)
// are then measured on the SAME loaded page by resizing the viewport (the responsive CSS/JS reacts to the resize exactly as it does
// when a user rotates the device), so the slow part (server + database) is paid once, not ten times.
// A case is clean only when the page really rendered (not an error page / still loading), nothing pokes past the screen edge, rows
// of buttons / dropdown contents fit, tables scroll inside their own container, the chat button does not cover the bottom bar,
// the theme / direction / language are really applied, and the page raised no script error.
// Env: BASE, RBAC_SECRET, ROUTES, OUT, SHARD, SHARDS, LANGS (default all 5), THEMES (default day,night,system), SHOTS
import fs from "node:fs";
import { webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:3250";
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const SHARD = Number(process.env.SHARD || 0), SHARDS = Number(process.env.SHARDS || 1);
const ROUTES = fs.readFileSync(process.env.ROUTES, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const LANGS = (process.env.LANGS || "en,ur,ar,fa,ps").split(",");
const THEMES = (process.env.THEMES || "day,night,system").split(",");
const RESULTS = `${OUT}/results-${SHARD}.jsonl`;
const SHOTS = process.env.SHOTS || `${OUT}/shots`; fs.mkdirSync(SHOTS, { recursive: true });
const CLASSES = {
  phone: { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1", dpr: 3,
    sizes: [["iphone-se", 375, 667], ["huawei-p", 360, 780], ["iphone15", 393, 852], ["samsung-s", 412, 915], ["iphone17promax", 440, 956], ["iphone17promax-land", 956, 440]] },
  desktop: { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15", dpr: 1, mobile: false,
    sizes: [["laptop-1366", 1366, 768], ["macbook-13", 1440, 900], ["desktop-1920", 1920, 1080], ["desktop-2560", 2560, 1440]] },
  tablet: { ua: "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1", dpr: 2,
    sizes: [["ipad-portrait", 820, 1180], ["android-tab-portrait", 800, 1280], ["ipad-landscape", 1180, 820], ["android-tab-landscape", 1280, 800]] },
};
// DEV-only passwordless session (server must run with ALLOW_DEV_SESSION=true against the DEV database)
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("mobile-sweep only runs against a local DEV server");
const res = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = (res.headers.getSetCookie() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

const done = new Set();
for (const f of fs.readdirSync(OUT).filter((x) => x.startsWith("results-"))) for (const l of fs.readFileSync(`${OUT}/${f}`, "utf8").split("\n")) { try { const r = JSON.parse(l); if (!(r.bad || []).some((b) => b === "loadFailed" || b === "stuckLoading" || b === "stacks" || b === "pageError" || b === "errorPage")) done.add(r.key); } catch {} }

const measure = () => {
  const vw = innerWidth, de = document.documentElement;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return p; } return null; };
  const outside = [...document.querySelectorAll("button, a, input, select, textarea, h1, h2, h3, h4, label, th, [role=dialog] *")]
    .filter((el) => vis(el) && !inScroller(el) && (el.getBoundingClientRect().right > vw + 1 || el.getBoundingClientRect().left < -1))
    .slice(0, 6).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || el.placeholder || el.name || "").trim().slice(0, 24)}`);
  // a single word / code broken across lines (letter-by-letter wrapping) — wrapping BETWEEN words is normal and not flagged
  const stacks = [...document.querySelectorAll("[data-erp-content] *")]
    .filter((el) => { if (el.children.length) return false; const t = (el.textContent || "").trim(); if (t.length < 6 || t.length > 60 || /\s/.test(t) || !vis(el)) return false; const cs = getComputedStyle(el); const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0); const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 14) * 1.25; return el.getBoundingClientRect().height - pad > lh * 2.2; })
    .map((el) => el.textContent.trim().slice(0, 24)).slice(0, 5);
  const tables = [...document.querySelectorAll("table")].filter(vis);
  const nav = document.querySelector("nav.fixed.bottom-0"), fab = document.querySelector("[data-dgt-connect] button");
  let fabOverNav = false;
  if (nav && fab && getComputedStyle(nav).display !== "none" && vis(fab)) { const a = nav.getBoundingClientRect(), b = fab.getBoundingClientRect(); fabOverNav = !(b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right); }
  const body = (document.querySelector("[data-erp-content]")?.innerText || document.body.innerText || "").trim();
  const loading = [...document.querySelectorAll("[data-erp-content] .animate-spin, [data-erp-content] .animate-pulse")].filter((el) => { if (!vis(el)) return false; const r = el.getBoundingClientRect(); return el.classList.contains("animate-spin") ? (r.width >= 14 && !el.closest("button")) : (r.width > 120 && r.height > 24 && !(el.textContent || "").trim()); }).length > 0;
  const errorPage = /application error|something went wrong|this page could not be found|internal server error|unhandled runtime error/i.test(body.slice(0, 600));
  const h1 = (document.querySelector("[data-erp-content] h1, h1")?.textContent || "").trim().slice(0, 60);
  // English left on a non-English screen: visible text nodes made only of Latin words (not codes / numbers / names) in the content area
  return {
    themeAttr: de.dataset.erpThemeMode, dark: de.classList.contains("dark"), dir: de.dir, htmlLang: de.lang,
    overflowX: de.scrollWidth > vw + 1, outside, stacks, tables: tables.length, tablesNoScroller: tables.filter((t) => !inScroller(t) && (t.getBoundingClientRect().right > vw + 1 || t.scrollWidth > (t.parentElement ? t.parentElement.clientWidth : vw) + 1)).length,
    fabOverNav, loading, errorPage, textLen: body.length, h1, h: de.scrollHeight,
    tiny: [...document.querySelectorAll("button, a, input, select")].filter((el) => vis(el) && el.getBoundingClientRect().height < 24 && el.getBoundingClientRect().width < 24).length,
  };
};

const browser = await webkit.launch();
const log = (o) => fs.appendFileSync(RESULTS, JSON.stringify(o) + "\n");
const myRoutes = ROUTES.filter((_, i) => i % SHARDS === SHARD);
for (const route of myRoutes) for (const lang of LANGS) for (const theme of THEMES) for (const [cls, C] of Object.entries(CLASSES).filter(([k]) => (process.env.CLASSES || "phone,tablet").split(",").includes(k))) {
  const todo = C.sizes.filter(([d]) => !done.has(`${route}|${d}|${lang}|${theme}`));
  if (!todo.length) continue;
  const [d0, w0, h0] = C.sizes[0];
  const ctx = await browser.newContext({ viewport: { width: w0, height: h0 }, deviceScaleFactor: C.dpr, isMobile: C.mobile !== false, hasTouch: C.mobile !== false, userAgent: C.ua, colorScheme: theme === "system" ? "dark" : "light" });
  const t0 = Date.now();
  const wd = setTimeout(() => { ctx.close().catch(() => {}); }, 240000); // watchdog: a hung page / a sleeping PC can never block a worker
  const page = await ctx.newPage();
  const errs = [], badApi = [];
  try {
    await ctx.addCookies([
      { name: "erp_session", value: token, domain: new URL(BASE).hostname, path: "/" },
      { name: "erp_lang", value: lang, domain: new URL(BASE).hostname, path: "/" },
      { name: "erp_theme_mode", value: theme, domain: new URL(BASE).hostname, path: "/" },
    ]);
    await ctx.addInitScript(([t, l]) => { try { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); } catch {} }, [theme, lang]);
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    page.on("response", (r) => { const u = r.url(); if (u.includes("/api/") && r.status() >= 400) badApi.push(`${r.status()} ${u.replace(BASE, "").slice(0, 70)}`); });
    const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    for (let i = 0; i < 24; i++) { const sl = await page.evaluate(() => [...document.querySelectorAll("[data-erp-content] .animate-spin, [data-erp-content] .animate-pulse")].some((el) => { const b = el.getBoundingClientRect(); return el.classList.contains("animate-spin") ? (b.width >= 14 && !el.closest("button")) : (b.width > 120 && b.height > 24 && !(el.textContent || "").trim()); })).catch(() => false); if (!sl) break; await page.waitForTimeout(2500); }
    const finalPath = page.url().replace(BASE, "");
    const loadMs = Date.now() - t0;
    for (const [dev, w, h] of C.sizes) {
      const key = `${route}|${dev}|${lang}|${theme}`;
      if (done.has(key)) continue;
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(900);
      const m = await page.evaluate(measure);
      const bad = [];
      if (m.overflowX) bad.push("overflowX");
      if (m.outside.length) bad.push("outside");
      if (m.stacks.length) bad.push("stacks");
      if (m.tablesNoScroller) bad.push("tableNoScroller");
      if (m.fabOverNav) bad.push("fabOverNav");
      if (m.errorPage) bad.push("errorPage");
      if (m.loading) bad.push("stuckLoading");
      const wantDark = theme === "night" || theme === "system";
      if (m.dark !== wantDark) bad.push("themeMismatch");
      if (m.themeAttr && m.themeAttr !== theme) bad.push("themeAttr");
      if (m.htmlLang && m.htmlLang.slice(0, 2) !== lang) bad.push("langMismatch");
      if ((lang === "en") !== (m.dir === "ltr")) bad.push("dirMismatch");
      if (errs.length) bad.push("pageError");
      if (resp && resp.status() >= 400) bad.push("http" + resp.status());
      const note = finalPath.split("?")[0] !== route.split("?")[0] ? "redirect:" + finalPath.slice(0, 60) : "";
      if (bad.length) await page.screenshot({ path: `${SHOTS}/${route.replace(/[^a-z0-9]+/gi, "_")}-${dev}-${lang}-${theme}.png` }).catch(() => {});
      log({ key, r: route, device: dev, lang, theme, cls, bad, note, loadMs, badApi: badApi.slice(0, 3), errs: errs.slice(0, 2), ...m });
    }
  } catch (e) {
    for (const [dev] of C.sizes) log({ key: `${route}|${dev}|${lang}|${theme}`, r: route, device: dev, lang, theme, cls, bad: ["loadFailed"], err: String(e).slice(0, 140) });
  } finally { clearTimeout(wd); await page.close().catch(() => {}); await ctx.close().catch(() => {}); }
}
await browser.close();
console.log("SHARD-DONE", SHARD);
