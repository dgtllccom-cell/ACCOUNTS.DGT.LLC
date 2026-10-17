/**
 * DEV only — authenticated browser check of /dashboard/purchase/stock/report.
 *   BASE=http://localhost:3510 OUT=<dir> [ROLE=super_admin] node scripts/dev/sbr-ui-e2e.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const OUT = process.env.OUT; if (!OUT) throw new Error("OUT required"); fs.mkdirSync(OUT, { recursive: true });
const ROLE = process.env.ROLE || "super_admin";
const LANGS = (process.env.LANGS || "en,ur,ar,fa,ps").split(",");
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) }); console.log(ok ? "PASS" : "FAIL", name, detail ? "· " + String(detail).slice(0, 160) : ""); };

const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: ROLE }) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) } });
const errors = [];
const RTL = { ur: 1, ar: 1, fa: 1, ps: 1 };
const LATIN_LEFT = /\b(Total Purchase|Total Sales|Remaining Stock|Stock Treatment|Total Lots|Purchase Bill Journal|View Full Journal)\b/;
for (const lang of LANGS) {
  await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: lang, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(([l]) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} }, [lang]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(lang + " pageerror: " + String(e).slice(0, 160)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to fetch|favicon|Failed to load resource|ResizeObserver|DevTools|presence/i.test(m.text())) errors.push(lang + " console: " + m.text().slice(0, 200)); });
  await p.goto(BASE + "/dashboard/purchase/stock/report", { waitUntil: "load", timeout: 240000 });
  await p.waitForSelector("[data-testid^='sbr-']", { timeout: 180000 }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector(".animate-spin") , null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(2500);
  const dir = await p.evaluate(() => document.documentElement.dir || document.body.dir);
  const txt = await p.evaluate(() => document.body.innerText);
  check(`${lang}: report renders`, (await p.locator("[data-testid^='sbr-']").count()) > 0, "testids=" + (await p.locator("[data-testid^='sbr-']").count()));
  check(`${lang}: direction`, (RTL[lang] ? "rtl" : "ltr") === dir, dir);
  if (lang !== "en") check(`${lang}: main chrome not English`, !LATIN_LEFT.test(txt), (txt.match(LATIN_LEFT) || [""])[0]);
  await p.screenshot({ path: `${OUT}/report-${lang}.png`, fullPage: false });
  await p.close();
}
check("no page/console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await b.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
