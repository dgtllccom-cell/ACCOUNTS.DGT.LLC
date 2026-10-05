// DEV-only: collect the rendered table headings of every route (desktop size), per language. Saves nothing in the ERP.
// Env: RBAC_SECRET, ROUTES (file), OUT (json), LANG_CODE (default en)
import fs from "node:fs";
import { webkit } from "playwright";
const BASE = process.env.BASE || "http://localhost:3230"; const LANG = process.env.LANG_CODE || "en";
const ROUTES = fs.readFileSync(process.env.ROUTES, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const lr = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "rbac.super@rbac-test.dev", password }), redirect: "manual" });
const token = lr.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: LANG, domain: "localhost", path: "/" }, { name: "erp_theme_mode", value: "day", domain: "localhost", path: "/" }]);
await ctx.addInitScript((l) => { try { localStorage.setItem("erp_lang", l); localStorage.setItem("erp_theme_mode", "day"); } catch {} }, LANG);
const out = {};
for (const r of ROUTES) {
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + r, { waitUntil: "load", timeout: 90000 }); await p.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {}); await p.waitForTimeout(Number(process.env.WAIT || 1500));
    for (let i = 0; i < 12; i++) { const sl = await p.evaluate(() => [...document.querySelectorAll("[data-erp-content] .animate-spin")].some((el) => el.getBoundingClientRect().width >= 14)).catch(() => false); if (!sl) break; await p.waitForTimeout(2500); }
    out[r] = await p.evaluate(() => [...document.querySelectorAll("table")].map((t) => [...t.querySelectorAll("thead th, tr:first-child th")].map((th) => { const cs = getComputedStyle(th); const r = th.getBoundingClientRect(); return { t: (th.innerText || th.textContent || "").trim().replace(/\s+/g, " "), a: cs.textAlign, f: cs.fontSize, w: cs.whiteSpace, h: Math.round(r.height), lh: parseFloat(cs.lineHeight) || 0 }; }).filter((x) => x.t)));
    console.log("ok", r, out[r].length);
  } catch (e) { console.log("fail", r, String(e).slice(0, 80)); }
  await p.close();
}
fs.writeFileSync(process.env.OUT, JSON.stringify(out)); await b.close(); console.log("HARVEST-DONE");
