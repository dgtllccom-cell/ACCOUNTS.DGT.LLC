// DEV-only, read-only responsive sweep of MANY routes in iPhone Safari's engine (WebKit). Saves nothing in the ERP.
// For every route it runs every phone/tablet size in English-Light, plus the same sizes in a rotating RTL language in Dark,
// plus one System-theme pass. A case is "clean" only when the page really rendered (not stuck loading / error / 404),
// nothing pokes past the screen edge, controls aren't hidden behind the chat button / bottom bar, and tables scroll inside
// their own container. Results are appended to a .jsonl file (resumable). Run several shards in parallel.
// Env: BASE, RBAC_SECRET, ROUTES (file, one route per line), OUT (dir), SHARD (0-based), SHARDS (count), SHOTS (dir for flagged screenshots)
import fs from "node:fs";
import { webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const SHARD = Number(process.env.SHARD || 0), SHARDS = Number(process.env.SHARDS || 1);
const ROUTES = fs.readFileSync(process.env.ROUTES, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const ONLY_DEVICES = (process.env.DEVICES || "").split(",").filter(Boolean);
const RESULTS = `${OUT}/results-${SHARD}.jsonl`;
const SHOTS = process.env.SHOTS || `${OUT}/shots`; fs.mkdirSync(SHOTS, { recursive: true });
const DEVICES = [
  { key: "iphone-se", w: 375, h: 667, dpr: 2, phone: true },
  { key: "iphone15", w: 393, h: 852, dpr: 3, phone: true },
  { key: "iphone17promax", w: 440, h: 956, dpr: 3, phone: true },
  { key: "iphone17promax-land", w: 956, h: 440, dpr: 3, phone: true },
  { key: "samsung-s", w: 412, h: 915, dpr: 3, phone: true },
  { key: "huawei-p", w: 360, h: 780, dpr: 3, phone: true },
  { key: "ipad-portrait", w: 820, h: 1180, dpr: 2 },
  { key: "ipad-landscape", w: 1180, h: 820, dpr: 2 },
  { key: "android-tab-portrait", w: 800, h: 1280, dpr: 2 },
  { key: "android-tab-landscape", w: 1280, h: 800, dpr: 2 },
].filter((d) => !ONLY_DEVICES.length || ONLY_DEVICES.includes(d.key));
const RTL = ["ur", "ar", "fa", "ps"];
const UA_PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const UA_TABLET = "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = (res.headers.getSetCookie() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

const done = new Set(); // resume: every earlier result file in OUT counts (shard layout may change between runs); load failures are retried
for (const f of fs.readdirSync(OUT).filter((x) => x.startsWith("results-"))) for (const l of fs.readFileSync(`${OUT}/${f}`, "utf8").split("\n")) { try { const r = JSON.parse(l); if (!(r.bad || []).some((b) => b === "loadFailed" || b === "stuckLoading")) done.add(r.key); } catch {} }

const measure = () => {
  const vw = innerWidth, de = document.documentElement;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") return p; } return null; };
  const outside = [...document.querySelectorAll("button, a, input, select, textarea, h1, h2, h3, h4, label, th, [role=dialog] *")]
    .filter((el) => vis(el) && !inScroller(el) && (el.getBoundingClientRect().right > vw + 1 || el.getBoundingClientRect().left < -1))
    .slice(0, 6).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || el.placeholder || el.name || "").trim().slice(0, 24)}`);
  const stacks = [...document.querySelectorAll("[data-erp-content] h1, [data-erp-content] h2, [data-erp-content] h3, [data-erp-content] span.font-bold, [data-erp-content] span.font-mono")]
    .filter((el) => { const r = el.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(el).lineHeight) || 16; return r.width > 0 && r.width < 90 && r.height > lh * 3; })
    .map((el) => el.textContent.trim().slice(0, 24)).slice(0, 5);
  const tables = [...document.querySelectorAll("table")].filter(vis);
  const nav = document.querySelector("nav.fixed.bottom-0"), fab = document.querySelector("[data-dgt-connect] button");
  let fabOverNav = false;
  if (nav && fab && getComputedStyle(nav).display !== "none" && vis(fab)) { const a = nav.getBoundingClientRect(), b = fab.getBoundingClientRect(); fabOverNav = !(b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right); }
  const body = (document.querySelector("[data-erp-content]")?.innerText || document.body.innerText || "").trim();
  const loading = [...document.querySelectorAll("[data-erp-content] .animate-spin, [data-erp-content] [class*=skeleton], [data-erp-content] .animate-pulse")].filter(vis).length > 0;
  const errorPage = /application error|something went wrong|this page could not be found|404|internal server error|unhandled runtime error/i.test(body.slice(0, 600));
  const h1 = (document.querySelector("[data-erp-content] h1, h1")?.textContent || "").trim().slice(0, 60);
  return {
    theme: de.dataset.erpThemeMode, dark: de.classList.contains("dark"), dir: de.dir, lang: de.lang,
    overflowX: de.scrollWidth > vw + 1, outside, stacks,
    tables: tables.length, tablesNoScroller: tables.filter((t) => !inScroller(t)).length,
    fabOverNav, loading, errorPage, textLen: body.length, h1, h: de.scrollHeight, tiny: [...document.querySelectorAll("button, a, input, select")].filter((el) => vis(el) && el.getBoundingClientRect().height < 24 && el.getBoundingClientRect().width < 24).length,
  };
};

const browser = await webkit.launch();
const combos = (rIdx) => [
  { lang: "en", theme: "day", tag: "en-day" },
  { lang: RTL[rIdx % 4], theme: "night", tag: "rtl-night" },
];
const myRoutes = ROUTES.map((r, i) => ({ r, i })).filter((x) => x.i % SHARDS === SHARD);
const log = (o) => fs.appendFileSync(RESULTS, JSON.stringify(o) + "\n");

const runPlan = [];
// every size is covered at least once per route: narrow phones, standard phones, landscape phone, portrait tablets, landscape tablets
const BOTH = ["iphone-se", "huawei-p", "iphone17promax-land", "ipad-portrait", "ipad-landscape"];
const EN_ONLY = ["iphone15", "iphone17promax", "samsung-s"];
const RTL_ONLY = ["iphone15", "android-tab-portrait", "android-tab-landscape"];
for (const D of DEVICES) {
  if (BOTH.includes(D.key) || EN_ONLY.includes(D.key)) runPlan.push({ D, lang: "en", theme: "day", tag: "en-day", routes: myRoutes });
  if (BOTH.includes(D.key) || RTL_ONLY.includes(D.key)) for (let k = 0; k < 4; k++) runPlan.push({ D, lang: RTL[k], theme: "night", tag: "rtl-night", routes: myRoutes.filter((x) => x.i % 4 === k) });
}
runPlan.push({ D: DEVICES.find((d) => d.key === "iphone15") || DEVICES[0], lang: "en", theme: "system", tag: "en-system", routes: myRoutes });

for (const plan of runPlan) {
  const { D, lang, theme, tag, routes } = plan;
  const todo = routes.filter((x) => !done.has(`${x.r}|${D.key}|${tag}|${lang}`));
  if (!todo.length) continue;
  const ctx = await browser.newContext({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: D.dpr, isMobile: true, hasTouch: true, userAgent: D.phone ? UA_PHONE : UA_TABLET });
  await ctx.addCookies([
    { name: "erp_session", value: token, domain: "localhost", path: "/" },
    { name: "erp_lang", value: lang, domain: "localhost", path: "/" },
    { name: "erp_theme_mode", value: theme, domain: "localhost", path: "/" },
  ]);
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); } catch {} }, [theme, lang]);
  for (const { r } of todo) {
    const key = `${r}|${D.key}|${tag}|${lang}`;
    const t0 = Date.now();
    const page = await ctx.newPage();
    const errs = [], badApi = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    page.on("response", (resp) => { const u = resp.url(); if (u.includes("/api/") && resp.status() >= 400) badApi.push(`${resp.status()} ${u.replace(BASE, "").slice(0, 70)}`); });
    try {
      const resp = await page.goto(BASE + r, { waitUntil: "load", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      // data must have finished loading, otherwise the measurement is vacuous: wait while a spinner / skeleton is still showing
      for (let i = 0; i < 24; i++) { const stillLoading = await page.evaluate(() => [...document.querySelectorAll("[data-erp-content] .animate-spin, [data-erp-content] .animate-pulse")].some((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; })).catch(() => false); if (!stillLoading) break; await page.waitForTimeout(2500); }
      const m = await page.evaluate(measure);
      const finalPath = page.url().replace(BASE, "");
      const bad = [];
      if (m.overflowX) bad.push("overflowX");
      if (m.outside.length) bad.push("outside");
      if (m.stacks.length) bad.push("stacks");
      if (m.tablesNoScroller) bad.push("tableNoScroller");
      if (m.fabOverNav) bad.push("fabOverNav");
      if (m.errorPage) bad.push("errorPage");
      if (m.loading) bad.push("stuckLoading");
      if (theme !== "system" && m.dark !== (theme === "night")) bad.push("themeMismatch");
      if (m.lang && m.lang.slice(0, 2) !== lang) bad.push("langMismatch");
      if ((lang === "en") !== (m.dir === "ltr")) bad.push("dirMismatch");
      if (errs.length) bad.push("pageError");
      if (resp && resp.status() >= 400) bad.push("http" + resp.status());
      const redirected = finalPath.split("?")[0] !== r.split("?")[0];
      const note = redirected ? "redirect:" + finalPath.slice(0, 60) : "";
      if (bad.length) {
        const f = `${SHOTS}/${r.replace(/[^a-z0-9]+/gi, "_")}-${D.key}-${tag}.png`;
        await page.screenshot({ path: f }).catch(() => {});
      }
      log({ key, r, device: D.key, tag, lang, theme, bad, note, ms: Date.now() - t0, badApi: badApi.slice(0, 3), errs: errs.slice(0, 2), ...m });
    } catch (e) {
      log({ key, r, device: D.key, tag, lang, theme, bad: ["loadFailed"], err: String(e).slice(0, 140), ms: Date.now() - t0 });
    } finally { await page.close().catch(() => {}); }
  }
  await ctx.close().catch(() => {});
}
await browser.close();
console.log("SHARD-DONE", SHARD);
