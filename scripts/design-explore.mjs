// DEV-only DEPTH check: open the dialogs / tabs / expanded sections / previews of every route and measure each opened state.
// Saves nothing in the ERP: it never clicks a control whose English label looks like delete / save / post / send / approve / reset /
// confirm / transfer / etc., never submits, and does not follow links (route changes are detected and the page is reloaded).
// MODE=plan : English + Light at one size -> writes the list of safe controls per route (by position in the page, language independent)
// MODE=run  : replays that list in the requested languages / themes / sizes and measures every state it opens
// Env: BASE, RBAC_SECRET, ROUTES (file), OUT, MODE, SIZES (keys), LANGS, THEMES, MAXPER (default 14), SHARD, SHARDS
import fs from "node:fs";
import { webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:3230";
const OUT = process.env.OUT; fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const MODE = process.env.MODE || "run";
const SHARD = Number(process.env.SHARD || 0), SHARDS = Number(process.env.SHARDS || 1);
const ROUTES = fs.readFileSync(process.env.ROUTES, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).filter((_, i) => i % SHARDS === SHARD);
const MAXPER = Number(process.env.MAXPER || 14);
const ALLSIZES = { "iphone-se": [375, 667, true], "iphone17promax": [440, 956, true], "ipad-portrait": [820, 1180, true], "macbook-13": [1440, 900, false], "ipad-landscape": [1180, 820, true], "iphone17promax-land": [956, 440, true], "desktop-1920": [1920, 1080, false] };
const SIZES = (process.env.SIZES || "iphone-se,iphone17promax,ipad-portrait,macbook-13").split(",");
const LANGS = (process.env.LANGS || "en").split(","), THEMES = (process.env.THEMES || "day").split(",");
const UA = { true: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1", false: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15" };
const PLAN_FILE = `${OUT}/plan.json`;
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);

const DENY = /back to|delet|remov|reset|disabl|deactiv|activat|approv|reject|confirm|post\b|submit|save|send|finali[sz]|cancel|logout|sign out|clear|void|publish|transfer|handover|accept|undo|import|upload|download|export|excel|csv|install|sync|refresh|reload|email|whatsapp|share|voice|mic|call|assign|generate|create|issue|retry|run |start|stop|pay|close current|✕|×/i;
const SEL = '[data-erp-content] button, [data-erp-content] [role="tab"], [data-erp-content] summary, [data-erp-content] [role="combobox"]';
const LIST = `(() => { const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.disabled; };
  return [...document.querySelectorAll(${JSON.stringify(SEL)})].map((el, i) => ({ i, el })).filter((x) => vis(x.el)).map((x) => ({ i: x.i, label: ((x.el.getAttribute("aria-label") || x.el.textContent || "").trim().replace(/\\s+/g, " ")).slice(0, 40), type: x.el.getAttribute("type") || "", tag: x.el.tagName.toLowerCase(), pop: x.el.getAttribute("aria-haspopup") || "", sig: (x.el.className || "").toString().slice(0, 60) })); })()`;
const MEASURE = `(() => { const vw = innerWidth, vh = innerHeight, de = document.documentElement;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const layers = [...document.querySelectorAll('[role="dialog"], .fixed.inset-0[class*="z-"]')].filter(vis);
  const lay = layers.map((l) => { const r = l.getBoundingClientRect(); const cs = getComputedStyle(l); const inner = [...l.querySelectorAll("button, a, input, select, textarea")].filter(vis);
    const out = inner.filter((e) => { const b = e.getBoundingClientRect(); return b.right > vw + 1 || b.left < -1; }).length;
    return { w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom), cut: out, scroll: cs.overflowY === "auto" || cs.overflowY === "scroll" || l.scrollHeight <= l.clientHeight + 2 }; });
  const bad = []; if (de.scrollWidth > vw + 1) bad.push("overflowX");
  for (const l of lay) { if (l.cut) bad.push("dialogControlsOffscreen"); if (l.r > vw + 2) bad.push("dialogWiderThanScreen"); if (l.b > vh + 2 && !l.scroll) bad.push("dialogTallerThanScreen"); }
  return { dir: de.dir, dark: de.classList.contains("dark"), layers: lay.length, lay, bad, err: /application error|something went wrong|unhandled runtime error/i.test((document.body.innerText || "").slice(0, 400)) }; })()`;

const browser = await webkit.launch();
const log = (f, o) => fs.appendFileSync(f, JSON.stringify(o) + "\n");
const plan = fs.existsSync(PLAN_FILE) ? JSON.parse(fs.readFileSync(PLAN_FILE, "utf8")) : {};

async function openCtx(size, lang, theme) {
  const [w, h, touch] = ALLSIZES[size];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch, userAgent: UA[touch] });
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: theme, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([t, l]) => { try { localStorage.setItem("erp_theme_mode", t); localStorage.setItem("erp_lang", l); } catch {} }, [theme, lang]);
  return ctx;
}
async function load(page, route) {
  await page.goto(BASE + route, { waitUntil: "load", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  for (let i = 0; i < 16; i++) { const sl = await page.evaluate(() => [...document.querySelectorAll("[data-erp-content] .animate-spin")].some((el) => el.getBoundingClientRect().width >= 14)).catch(() => false); if (!sl) break; await page.waitForTimeout(2500); }
}

if (MODE === "plan") {
  const file = `${OUT}/plan-${SHARD}.json`; const out = {};
  for (const size of SIZES) {
    const ctx = await openCtx(size, "en", "day");
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      try {
        await load(page, route);
        const all = await page.evaluate(LIST);
        const safe = all.filter((x) => x.label && !DENY.test(x.label) && x.type !== "submit").slice(0, MAXPER);
        (out[size] ||= {})[route] = safe.map((x) => ({ i: x.i, label: x.label, sig: x.sig }));
        console.log("plan", size, route, safe.length, "of", all.length);
      } catch (e) { console.log("plan-fail", size, route, String(e).slice(0, 80)); }
      await page.close();
    }
    await ctx.close();
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
} else {
  const merged = {};
  for (const f of fs.readdirSync(OUT).filter((x) => /^plan-\d+\.json$/.test(x))) { const p = JSON.parse(fs.readFileSync(`${OUT}/${f}`, "utf8")); for (const [sz, r] of Object.entries(p)) Object.assign((merged[sz] ||= {}), r); }
  const RES = `${OUT}/results-${SHARD}.jsonl`;
  const done = new Set(); for (const f of fs.readdirSync(OUT).filter((x) => x.startsWith("results-"))) for (const l of fs.readFileSync(`${OUT}/${f}`, "utf8").split("\n")) { try { done.add(JSON.parse(l).key); } catch {} }
  for (const size of SIZES) for (const lang of LANGS) for (const theme of THEMES) {
    const ctx = await openCtx(size, lang, theme);
    for (const route of ROUTES) {
      const steps = (merged[size] || {})[route] || [];
      const todo = steps.filter((s) => !done.has(`${route}|${size}|${lang}|${theme}|${s.i}`));
      if (!todo.length) continue;
      let page = await ctx.newPage(); let loaded = false;
      for (const s of todo) {
        const key = `${route}|${size}|${lang}|${theme}|${s.i}`;
        try {
          if (!loaded) { await load(page, route); loaded = true; }
          const before = page.url();
          await page.evaluate(`(() => { const all = [...document.querySelectorAll(${JSON.stringify(SEL)})]; let el = all[${s.i}]; const sig = ${JSON.stringify(s.sig || "")}; if (sig && (!el || (el.className || "").toString().slice(0, 60) !== sig)) el = all.find((e) => (e.className || "").toString().slice(0, 60) === sig) || el; if (el) el.click(); })()`);
          await page.waitForTimeout(1100);
          const m = await page.evaluate(MEASURE);
          const moved = page.url() !== before;
          const bad = [...m.bad]; if (m.err) bad.push("errorPage"); if (m.dir !== (lang === "en" ? "ltr" : "rtl")) bad.push("dirMismatch"); if (m.dark !== (theme === "night")) bad.push("themeMismatch");
          if (bad.length) await page.screenshot({ path: `${OUT}/shots/${route.replace(/[^a-z0-9]+/gi, "_")}-${size}-${lang}-${theme}-el${s.i}.png` }).catch(() => {});
          log(RES, { key, r: route, size, lang, theme, i: s.i, label: s.label, layers: m.layers, bad, moved });
          // restore a clean state for the next control
          await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(250); await page.keyboard.press("Escape").catch(() => {});
          const still = await page.evaluate(`document.querySelectorAll('[role="dialog"], .fixed.inset-0[class*="z-"]').length`).catch(() => 0);
          if (still || moved) { await page.close(); page = await ctx.newPage(); loaded = false; }
        } catch (e) { log(RES, { key, r: route, size, lang, theme, i: s.i, label: s.label, bad: ["stepFailed"], err: String(e).slice(0, 100) }); await page.close().catch(() => {}); page = await ctx.newPage(); loaded = false; }
      }
      await page.close().catch(() => {});
    }
    await ctx.close();
  }
}
await browser.close();
console.log("EXPLORE-DONE", MODE, SHARD);
