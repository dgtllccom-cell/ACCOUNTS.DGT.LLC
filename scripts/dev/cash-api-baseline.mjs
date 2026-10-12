/**
 * DEV only: record every /api/erp/* GET the Cash Journal page makes (URL + normalised JSON body) for a role/scope.
 *   BASE=http://localhost:3300 OUT=<file.json> [ROLE=.. COUNTRY_ID=.. COUNTRY_BRANCH_ID=.. CITY_BRANCH_ID=..] [PATH_ERP=/dashboard/roznamcha/cash-entry] node scripts/dev/cash-api-baseline.mjs
 * Run before and after a design change and diff the two files (scripts/dev/cash-api-diff.mjs) to prove totals/balances are identical.
 */
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3300"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const body = { role: process.env.ROLE || "super_admin", countryId: process.env.COUNTRY_ID || undefined, countryBranchId: process.env.COUNTRY_BRANCH_ID || undefined, cityBranchId: process.env.CITY_BRANCH_ID || undefined, operationalDomain: process.env.DOMAIN || undefined };
const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const token = r.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("erp_session=")).slice(12);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "erp_session", value: token, domain: "localhost", path: "/" }, { name: "erp_lang", value: "en", domain: "localhost", path: "/" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("erp_lang", "en"); localStorage.setItem("erp_app_install_dismissed", "1"); } catch {} });
const p = await ctx.newPage(); const calls = {};
p.on("response", async (res) => {
  const u = new URL(res.url());
  if (!u.pathname.startsWith("/api/erp/") || res.request().method() !== "GET") return;
  if (/auth\/|notifications|presence|dgt-connect|health|heartbeat|session/.test(u.pathname)) return;
  let txt = ""; try { txt = await res.text(); } catch {}
  let json; try { json = JSON.parse(txt); } catch { json = txt.slice(0, 200); }
  calls[u.pathname + u.search] = { status: res.status(), body: json };
});
await p.goto(BASE + (process.env.PATH_ERP || "/dashboard/roznamcha/cash-entry"), { waitUntil: "load", timeout: 240000 });
await p.waitForLoadState("networkidle", { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(8000);
// volatile fields (timestamps / request ids) are removed so before/after can be compared
const scrub = (v) => JSON.parse(JSON.stringify(v, (k, x) => (/^(generatedAt|requestId|now|timestamp|serverTime|fetchedAt)$/i.test(k) ? undefined : x)));
const out = Object.fromEntries(Object.entries(calls).sort().map(([k, v]) => [k, scrub(v)]));
fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
console.log("endpoints:", Object.keys(out).length); for (const [k, v] of Object.entries(out)) console.log(" ", v.status, k.slice(0, 110));
await b.close();
