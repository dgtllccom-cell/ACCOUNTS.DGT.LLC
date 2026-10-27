// DEV only, read-only: every Main Menu destination × EN/UR/AR/FA/PS × viewports.
// Per page-load: the document loads (no login bounce, no error page, no uncaught page error), <html dir> follows the language,
// no sideways page scroll, no "translation pending" placeholder, and — outside English — no UI sentence left in English
// (a text node equal to a multi-word English dictionary value that has its own translation in that language).
// Names, codes, amounts and other data are never judged. Usage:
//   node scripts/dev/five-language-sweep.mjs [--base http://localhost:3521] [--langs en,ur,ar,fa,ps] [--widths 1440,820,390] [--only /dashboard/x,/dashboard/y] [--workers 2]
import fs from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3521");
const LANGS = arg("langs", "en,ur,ar,fa,ps").split(",");
const WIDTHS = arg("widths", "1440,820,390").split(",").map(Number);
const WORKERS = Number(arg("workers", "2"));
const OUT = arg("out", ".tmp/five-language-sweep.json");

// Main Menu destinations (same source the nav-duplicate guard reads)
const nav = fs.readFileSync("components/layout/digital-dock-premium-sidebar.tsx", "utf8");
const hrefs = [...new Set([...nav.matchAll(/label:\s*(?:nt\()?"[^"]+"\)?[^{}]*?href:\s*"([^"]+)"/g)].map((m) => m[1]))];
const only = arg("only", "");
const SCREENS = only ? only.split(",") : hrefs.filter((h) => h.startsWith("/dashboard"));

// English UI sentences that have a real translation in each language
const ui = fs.readFileSync("lib/i18n/ui.ts", "utf8");
function block(name) {
  const start = ui.indexOf(`\nconst ${name}: Dict = {`);
  const end = ui.indexOf("\n};", start);
  const map = new Map();
  for (const m of ui.slice(start, end).matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\r?$/gm)) map.set(m[1], m[2].replace(/\\"/g, '"').replace(/\\n/g, " "));
  return map;
}
const en = block("en");
const english = {};
for (const lang of ["ur", "ar", "fa", "ps"]) {
  const d = block(lang);
  const set = new Set();
  for (const [k, v] of en) {
    const words = v.trim().split(/\s+/);
    if (words.length < 2 || v.length < 8 || !/^[A-Za-z][A-Za-z ,.'&()/-]*$/.test(v.trim())) continue;
    const tr = d.get(k);
    if (tr && tr !== v && /[؀-ۿ]/.test(tr)) set.add(v.trim());
  }
  english[lang] = set;
}
console.log(`screens ${SCREENS.length}; English UI sentences with a translation: ${Object.entries(english).map(([l, s]) => `${l} ${s.size}`).join(", ")}`);

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "super_admin" }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session="))?.slice(12);
if (!token) { console.error("no dev session (is the DEV server on", BASE, "with ALLOW_DEV_SESSION?)"); process.exit(2); }

// Data, not UI chrome: the DEV test user is literally named "Super Admin", and country names are place data.
// They are counted separately (dataHits) and never make a page fail.
const DATA_VALUES = new Set(["Super Admin", "United Arab Emirates", "Pakistan", "Afghanistan", "China", "India", "Iran"]);

// Results are appended to <out>.jsonl as they come, so a crash (the DEV server or the browser) loses nothing; re-running the same
// command resumes with the page-loads that are not done yet.
const JSONL = OUT.replace(/\.json$/, "") + ".jsonl";
const results = fs.existsSync(JSONL) ? fs.readFileSync(JSONL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const doneKeys = new Set(results.map((x) => `${x.lang}|${x.width}|${x.path}`));
const browser = await chromium.launch();
const jobs = [];
for (const lang of LANGS) for (const width of WIDTHS) for (const path of SCREENS) if (!doneKeys.has(`${lang}|${width}|${path}`)) jobs.push({ lang, width, path });
if (results.length) console.log(`resuming: ${results.length} page-loads already recorded, ${jobs.length} to go`);
let done = 0;

async function worker() {
  const contexts = new Map();
  while (jobs.length) {
    const job = jobs.shift();
    const key = `${job.lang}:${job.width}`;
    if (!contexts.has(key)) {
      for (const c of contexts.values()) await c.close();
      contexts.clear();
      const ctx = await browser.newContext({ viewport: { width: job.width, height: job.width < 800 ? 844 : 900 }, isMobile: job.width < 800, hasTouch: job.width < 800 });
      await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: job.lang, domain: "localhost", path: "/" }]);
      await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); } catch {} }, job.lang);
      contexts.set(key, ctx);
    }
    const page = await contexts.get(key).newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
    const fails = [];
    try {
      let resp;
      for (let attempt = 0; attempt < 4; attempt++) {
        try { resp = await page.goto(BASE + job.path, { waitUntil: "domcontentloaded", timeout: 120000 }); break; }
        catch (e) { if (!/ERR_CONNECTION|ERR_EMPTY_RESPONSE|ERR_SOCKET_NOT_CONNECTED|ECONNRESET/.test(String(e)) || attempt === 3) throw e; await page.waitForTimeout(15000); }
      }
      await page.waitForLoadState("networkidle", { timeout: Number(arg("idle", "6000")) }).catch(() => {});
      await page.waitForTimeout(1500);
      const status = resp?.status() ?? 0;
      if (status >= 400) fails.push(`HTTP ${status}`);
      if (/\/login(\?|$)/.test(new URL(page.url()).pathname + new URL(page.url()).search)) fails.push("bounced to login");
      const info = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const texts = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || el.closest("script,style,noscript,[data-floating-hidden],[aria-hidden=true]")) continue;
          const t = n.textContent.replace(/\s+/g, " ").trim();
          // the signed-in user's own name on the user-menu button is data (the DEV test user is literally named "Super Admin")
          if (el.closest("button[aria-label]")?.getAttribute("aria-label") === t) continue;
          if (t) texts.push(t);
        }
        return {
          dir: document.documentElement.getAttribute("dir") || getComputedStyle(document.documentElement).direction,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          errorPage: /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/.test(document.body.innerText),
          pending: /translation pending/i.test(document.body.innerText),
          texts
        };
      });
      const rtl = job.lang !== "en";
      if ((info.dir === "rtl") !== rtl) fails.push(`dir=${info.dir}`);
      if (info.overflow > 2) fails.push(`sideways scroll ${info.overflow}px`);
      if (info.errorPage) fails.push("error page");
      if (info.pending) fails.push("translation pending");
      if (rtl) {
        const found = [...new Set(info.texts.filter((t) => english[job.lang].has(t)))];
        const left = found.filter((t) => !DATA_VALUES.has(t));
        job.english = left;
        job.dataHits = found.filter((t) => DATA_VALUES.has(t));
        if (left.length) fails.push(`English UI: ${left.slice(0, 4).map((t) => JSON.stringify(t)).join(", ")}${left.length > 4 ? ` (+${left.length - 4})` : ""}`);
      }
      if (errors.length) fails.push(`page error: ${errors[0]}`);
    } catch (e) {
      fails.push(`load failed: ${String(e.message).split("\n")[0].slice(0, 120)}`);
    }
    await page.close().catch(() => {});
    const row = { ...job, ok: fails.length === 0, fails };
    results.push(row);
    fs.appendFileSync(JSONL, JSON.stringify(row) + "\n");
    done++;
    if (fails.length) console.log(`FAIL ${job.lang} ${job.width} ${job.path} — ${fails.join(" | ")}`);
    if (done % 50 === 0) console.log(`… ${done} page-loads, ${results.filter((x) => !x.ok).length} failing`);
  }
  for (const c of contexts.values()) await c.close();
}

await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
const failed = results.filter((x) => !x.ok);
console.log(`\nfive-language sweep: ${results.length - failed.length} PASS / ${failed.length} FAIL (${SCREENS.length} screens × ${LANGS.length} languages × ${WIDTHS.length} widths) → ${OUT}`);
process.exit(failed.length ? 1 : 0);
