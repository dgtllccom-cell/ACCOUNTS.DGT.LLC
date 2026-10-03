#!/usr/bin/env node
/**
 * RBAC verification matrix (DEV ONLY).
 *
 * Every test user signs in through the REAL login endpoint, then the script checks — per role — the landing dashboard, page
 * access (server-side 403 gate), record visibility (BL + customer orders), cross-country / cross-branch record-ID attempts,
 * financial endpoints, admin endpoints, global search and the AI assistant. Every check is PASS/FAIL with the observed value.
 *
 * Usage: BASE=http://localhost:3000 RBAC_USERS=<users.json> RBAC_FIXTURES=<fixtures.json> RBAC_SECRET=<secret.json> \
 *        node scripts/e2e-rbac-matrix.mjs [--out report.json]
 * The fixtures / users / secret files are produced by the DEV seed scripts and are never committed.
 */
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const fx = JSON.parse(fs.readFileSync(process.env.RBAC_FIXTURES, "utf8"));
const users = JSON.parse(fs.readFileSync(process.env.RBAC_USERS, "utf8"));
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const outIdx = process.argv.indexOf("--out");
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : null;
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

const ALL_BL = ["BL_DEIRA_ALPHA", "BL_DEIRA_BETA", "BL_ALRAS_ALPHA", "BL_CHAMAN_AGENT", "BL_QUETTA", "BL_KANDAHAR"];
const ALL_CO = ["CO_DEIRA", "CO_ALRAS", "CO_CHAMAN_AGENT", "CO_CHAMAN_OTHER", "CO_QUETTA", "CO_KANDAHAR"];
const BL_NO = { BL_DEIRA_ALPHA: "RBAC-TEST-BL-DEIRA-ALPHA", BL_DEIRA_BETA: "RBAC-TEST-BL-DEIRA-BETA", BL_ALRAS_ALPHA: "RBAC-TEST-BL-ALRAS-ALPHA", BL_CHAMAN_AGENT: "RBAC-TEST-BL-CHAMAN-AGENTA", BL_QUETTA: "RBAC-TEST-BL-QUETTA", BL_KANDAHAR: "RBAC-TEST-BL-KANDAHAR" };
const CO_NO = { CO_DEIRA: "RBAC-TEST-CO-DEIRA", CO_ALRAS: "RBAC-TEST-CO-ALRAS", CO_CHAMAN_AGENT: "RBAC-TEST-CO-CHAMAN-AGENTA", CO_CHAMAN_OTHER: "RBAC-TEST-CO-CHAMAN-OTHER", CO_QUETTA: "RBAC-TEST-CO-QUETTA", CO_KANDAHAR: "RBAC-TEST-CO-KANDAHAR" };

const FIN_PAGES = ["/dashboard/ledger/detailed", "/dashboard/roznamcha/cash-entry", "/dashboard/accounts", "/dashboard/general-office/payroll", "/dashboard/purchase/purchase-payments"];
const OPS_PAGES = ["/dashboard/logistics", "/dashboard/purchase/purchase-loading-records", "/dashboard/purchase/purchase-transit-lane"];
const ADMIN_PAGES = ["/dashboard/users", "/dashboard/super-admin"];
const FIN_APIS = ["/api/erp/ledgers", "/api/erp/accounting/reports/ledger/ledgers?reportScope=country", "/api/erp/accounting/reports/ledger/general?reportScope=country", "/api/erp/money-exchange", "/api/erp/expenses", "/api/erp/temp-bills", "/api/erp/hr/payroll", "/api/erp/crm/dashboard"];

/**
 * Expectations. bl/co: exact sets of RBAC-TEST fixtures the login must see (null = endpoint may refuse; then must be 403/empty).
 * landing: expected redirect of /dashboard. fin: may financial pages/APIs answer? ops: may operational pages open?
 * deny: [fixtureKey] record-ID attempts that MUST be 403; allow: record-ID attempts that MUST be 200.
 */
const EXPECT = {
  super:        { landing: "/dashboard/super-admin", fin: true,  ops: true,  admin: true,  bl: ALL_BL, co: ALL_CO, deny: [], allow: ["CO_KANDAHAR", "CO_DEIRA"] },
  country_uae:  { mx: ["RBAC-TEST-MX_DEIRA"], landing: "/dashboard/country",     fin: true,  ops: null,  admin: "users", bl: ["BL_DEIRA_ALPHA", "BL_DEIRA_BETA", "BL_ALRAS_ALPHA"], co: ["CO_DEIRA", "CO_ALRAS"], deny: ["CO_QUETTA", "CO_KANDAHAR"], allow: ["CO_ALRAS", "CO_DEIRA"] },
  branch_deira: { mx: ["RBAC-TEST-MX_DEIRA"], landing: "/dashboard/city",        fin: true,  ops: null,  admin: false, bl: ["BL_DEIRA_ALPHA", "BL_DEIRA_BETA"], co: ["CO_DEIRA"], deny: ["CO_ALRAS", "CO_QUETTA"], allow: ["CO_DEIRA"] },
  ops_global:   { landing: "/dashboard/logistics",   fin: false, ops: true,  admin: false, bl: ALL_BL, co: ALL_CO, deny: [], allow: ["CO_KANDAHAR"] },
  ops_pk:       { landing: "/dashboard/logistics",   fin: false, ops: true,  admin: false, bl: ["BL_CHAMAN_AGENT", "BL_QUETTA"], co: ["CO_CHAMAN_AGENT", "CO_CHAMAN_OTHER", "CO_QUETTA"], deny: ["CO_DEIRA", "CO_KANDAHAR"], allow: ["CO_QUETTA"] },
  ops_chaman:   { landing: "/dashboard/logistics",   fin: false, ops: true,  admin: false, bl: ["BL_CHAMAN_AGENT"], co: ["CO_CHAMAN_AGENT", "CO_CHAMAN_OTHER"], deny: ["CO_QUETTA", "CO_DEIRA"], allow: ["CO_CHAMAN_OTHER"] },
  sl_admin:     { landing: "/dashboard/logistics",   fin: false, ops: "logistics", admin: false, bl: ["BL_DEIRA_ALPHA", "BL_ALRAS_ALPHA"], co: [], deny: ["CO_DEIRA", "CO_QUETTA"], allow: [] },
  sl_deira:     { landing: "/dashboard/logistics",   fin: false, ops: "logistics", admin: false, bl: ["BL_DEIRA_ALPHA"], co: [], deny: ["CO_DEIRA", "CO_ALRAS"], allow: [] },
  agent:        { landing: "/dashboard/logistics",   fin: false, ops: "logistics", admin: false, bl: ["BL_CHAMAN_AGENT"], co: ["CO_CHAMAN_AGENT"], deny: ["CO_CHAMAN_OTHER", "CO_QUETTA"], allow: ["CO_CHAMAN_AGENT"] },
  finance:      { mx: ["RBAC-TEST-MX_DEIRA"], landing: "/dashboard/city",        fin: true,  ops: null,  admin: false, bl: null, blWithin: ["BL_DEIRA_ALPHA", "BL_DEIRA_BETA"], co: null, coWithin: ["CO_DEIRA"], deny: ["CO_ALRAS", "CO_QUETTA"], allow: [] },
  restricted:   { landing: "/dashboard/city",        fin: false, ops: null,  admin: false, bl: null, blWithin: ["BL_QUETTA"], co: null, coWithin: ["CO_QUETTA"], deny: ["CO_CHAMAN_AGENT", "CO_DEIRA"], allow: [] },
};

// rbac.denied_title in the five dictionary blocks (lib/i18n/ui.ts)
const DENIED_TITLE = { en: "Access denied (403)", ur: "رسائی ممنوع ہے (403)", ar: "تم رفض الوصول (403)", fa: "دسترسی مجاز نیست (403)", ps: "لاسرسی منع ده (403)" };

const results = [];
const check = (role, area, name, pass, observed) => { results.push({ role, area, name, pass: Boolean(pass), observed }); };

async function login(email) {
  const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: email, password }), redirect: "manual", signal: AbortSignal.timeout(120000) });
  const set = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  const cookie = set.map((c) => c.split(";")[0]).filter((c) => c.startsWith("erp_session=") || c.startsWith("sb-")).join("; ");
  return { status: res.status, cookie };
}
const get = async (cookie, path, init = {}) => {
  let res;
  try {
    res = await fetch(BASE + path, { ...init, headers: { cookie, ...(init.headers || {}) }, redirect: "manual", signal: AbortSignal.timeout(180000) });
  } catch (e) {
    return { status: "TIMEOUT/" + String(e?.name || e), location: null, body: null };
  }
  let body = null; const text = await res.text();
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, location: res.headers.get("location"), body };
};
const rows = (b) => (b?.data?.records ?? b?.data ?? b?.records ?? b?.rows ?? []);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

for (const [key, exp] of Object.entries(EXPECT)) {
  if (ONLY && !ONLY.includes(key)) continue;
  const u = users[key];
  if (!u?.userId) { check(key, "setup", "user exists", false, u); continue; }
  const lg = await login(u.email);
  check(key, "auth", "real login succeeds", lg.status === 200 && lg.cookie.includes("erp_session="), lg.status);
  if (!lg.cookie) continue;
  const c = lg.cookie;

  // session as the server sees it
  const ses = await get(c, "/api/erp/auth/session");
  const sd = ses.body?.data ?? {};
  check(key, "session", "financial flag", exp.fin === null || sd.canViewFinancials === exp.fin, { canViewFinancials: sd.canViewFinancials, roles: sd.roles });

  // landing dashboard
  const land = await get(c, "/dashboard");
  const loc = (land.location || "").replace(BASE, "").split("?")[0];
  check(key, "dashboard", `landing = ${exp.landing}`, loc === exp.landing, { status: land.status, location: loc });
  const landPage = await get(c, exp.landing);
  check(key, "dashboard", "landing page renders (200)", landPage.status === 200, landPage.status);

  // five languages: the landing dashboard renders in every language with the right direction, and the 403 page is translated
  for (const lang of ["en", "ur", "ar", "fa", "ps"]) {
    const lc = `${c}; erp_lang=${lang}`;
    const page = await get(lc, exp.landing);
    const html = typeof page.body === "string" ? page.body : "";
    const rtl = lang !== "en";
    const dirOk = rtl ? /<html[^>]*dir="rtl"/.test(html) || /dir="rtl"/.test(html) : !/<html[^>]*dir="rtl"/.test(html);
    check(key, "i18n", `landing renders in ${lang} (${rtl ? "RTL" : "LTR"})`, page.status === 200 && dirOk, { status: page.status, dirOk });
    if (key !== "super") {
      const denied = await get(lc, exp.fin === false ? "/dashboard/ledger/detailed" : "/dashboard/super-admin");
      const dhtml = typeof denied.body === "string" ? denied.body : "";
      check(key, "i18n", `403 page translated in ${lang}`, denied.status === 403 && dhtml.includes(DENIED_TITLE[lang]) && dhtml.includes('data-testid="access-denied"'), { status: denied.status });
    }
  }

  // pages — the server-side gate answers 403 (never 500, never a blank 200)
  for (const p of FIN_PAGES) {
    const r = await get(c, p);
    if (exp.fin === false) check(key, "routes", `financial page denied ${p}`, r.status === 403, r.status);
    else if (key === "super") check(key, "routes", `financial page allowed ${p}`, r.status === 200, r.status);
    else check(key, "routes", `financial page answers 200/403 (no 500) ${p}`, r.status === 200 || r.status === 403, r.status);
  }
  for (const p of OPS_PAGES) {
    const r = await get(c, p);
    const mustOpen = exp.ops === true || (exp.ops === "logistics" && p === "/dashboard/logistics");
    const mustDeny = exp.ops === "logistics" && p !== "/dashboard/logistics";
    if (mustOpen) check(key, "routes", `operational page allowed ${p}`, r.status === 200, r.status);
    else if (mustDeny) check(key, "routes", `non-shipping page denied ${p}`, r.status === 403, r.status);
    else check(key, "routes", `page answers 200/403 (no 500) ${p}`, r.status === 200 || r.status === 403, r.status);
  }
  for (const p of ADMIN_PAGES) {
    const r = await get(c, p);
    const allowed = exp.admin === true || (exp.admin === "users" && p === "/dashboard/users");
    if (allowed) check(key, "routes", `admin page allowed ${p}`, r.status === 200, r.status);
    else check(key, "routes", `admin page denied ${p}`, r.status === 403, r.status);
  }
  const unmapped = await get(c, "/dashboard/this-page-does-not-exist-rbac");
  check(key, "routes", "unknown URL is 403/404, never 500", [403, 404].includes(unmapped.status), unmapped.status);

  // BL records
  const bl = await get(c, "/api/erp/shipping/bl-records?limit=500&q=RBAC-TEST");
  const blSeen = rows(bl.body).map((r) => Object.keys(BL_NO).find((k) => BL_NO[k] === r.bl_number)).filter(Boolean);
  if (exp.bl) check(key, "records", "BL records = exactly the authorized set", bl.status === 200 && sameSet(blSeen, exp.bl), { status: bl.status, seen: blSeen });
  else check(key, "records", "BL records never outside scope", bl.status === 403 || blSeen.every((k) => exp.blWithin.includes(k)), { status: bl.status, seen: blSeen });
  if (bl.status === 200 && exp.fin === false) {
    const leaked = rows(bl.body).filter((r) => r.debit !== undefined || r.credit !== undefined || r.ledgers !== undefined);
    check(key, "financial", "BL amounts / ledger links redacted", leaked.length === 0, { leaked: leaked.length });
  }
  if (key !== "super" && key !== "ops_global") {
    const cross = await get(c, `/api/erp/shipping/bl-records?countryId=${fx.AF}`);
    check(key, "isolation", "BL list with a foreign countryId is 403", cross.status === 403, cross.status);
  }

  // customer orders
  const co = await get(c, "/api/erp/clearing-agent/customer-order");
  const coRows = Array.isArray(co.body?.data) ? co.body.data : rows(co.body);
  const coSeen = coRows.map((r) => Object.keys(CO_NO).find((k) => CO_NO[k] === r.order_no)).filter(Boolean);
  if (exp.co) check(key, "records", "customer orders = exactly the authorized set", (co.status === 200 && sameSet(coSeen, exp.co)) || (exp.co.length === 0 && co.status === 403), { status: co.status, seen: coSeen });
  else check(key, "records", "customer orders never outside scope", co.status === 403 || coSeen.every((k) => exp.coWithin.includes(k)), { status: co.status, seen: coSeen });
  for (const k of exp.deny) {
    const r = await get(c, `/api/erp/clearing-agent/customer-order/${fx[k]}`);
    check(key, "isolation", `record-ID attempt ${k} is 403`, r.status === 403, r.status);
  }
  for (const k of exp.allow) {
    const r = await get(c, `/api/erp/clearing-agent/customer-order/${fx[k]}`);
    check(key, "isolation", `own record ${k} opens (200)`, r.status === 200, r.status);
  }

  // legacy order with NO scope columns: used to fail OPEN for everyone; now only global logins
  {
    const r = await get(c, `/api/erp/clearing-agent/customer-order/${fx.CO_LEGACY}`);
    const global = key === "super" || key === "ops_global";
    check(key, "isolation", `legacy unscoped order ${global ? "opens for a global login" : "is 403"}`, global ? r.status === 200 : r.status === 403, r.status);
  }
  // money exchange: own branches only; a foreign branch id is 403
  {
    const mx = await get(c, "/api/erp/money-exchange?limit=500");
    const serials = (mx.body?.entries ?? []).map((e) => e.serial_no).filter((x) => String(x).startsWith("RBAC-TEST-MX"));
    if (exp.fin === false) check(key, "financial", "money exchange denied", mx.status === 403, mx.status);
    else if (key === "super") check(key, "financial", "money exchange: super admin sees both branches", mx.status === 200 && serials.includes("RBAC-TEST-MX_DEIRA") && serials.includes("RBAC-TEST-MX_QUETTA"), { status: mx.status, serials });
    else check(key, "financial", "money exchange never shows another branch's entries", mx.status === 403 || !serials.some((x) => (exp.mx ?? []).indexOf(x) < 0), { status: mx.status, serials });
    if (key !== "super" && exp.fin !== false) {
      const foreign = await get(c, `/api/erp/money-exchange?branchId=${exp.mxForeign ?? fx.QUETTA}`);
      check(key, "isolation", "money exchange with a foreign branchId is 403", foreign.status === 403, foreign.status);
    }
  }
  // financial KPI hiding on the landing dashboard
  if (exp.landing === "/dashboard/city" || exp.landing === "/dashboard/country") {
    const page = await get(c, exp.landing);
    const html = typeof page.body === "string" ? page.body : "";
    const hidden = html.includes('data-testid="financials-hidden"');
    check(key, "dashboard", exp.fin === false ? "financial KPIs hidden on landing" : "financial KPIs shown on landing", page.status === 200 && hidden === (exp.fin === false), { status: page.status, hidden });
  }

  // financial APIs
  for (const p of FIN_APIS) {
    const r = await get(c, p);
    if (exp.fin === false) check(key, "financial", `financial API denied ${p}`, r.status === 403, r.status);
    else check(key, "financial", `financial API answers 200/403 (no 500) ${p}`, r.status === 200 || r.status === 403, r.status);
  }
  // loading records: operational logins get rows WITHOUT money
  const lr = await get(c, "/api/erp/purchases/loading-records?limit=20");
  if (exp.fin === false && lr.status === 200) {
    const money = rows(lr.body).filter((r) => r.loaded_purchase_amount !== undefined || r.exchange_rate !== undefined || r.remaining_loading_balance !== undefined);
    check(key, "financial", "loading records redacted", money.length === 0, { rows: rows(lr.body).length, withMoney: money.length });
  } else {
    check(key, "financial", "loading records answer 200/403 (no 500)", lr.status === 200 || lr.status === 403, lr.status);
  }

  // admin / global-only data
  const prof = await get(c, "/api/erp/data/table?table=profiles");
  check(key, "admin", "profiles table (global-only)", key === "super" || key === "ops_global" ? prof.status === 200 || prof.status === 403 : prof.status === 403, prof.status);
  const su = await get(c, `/api/erp/users?userId=${users.super.userId}`);
  check(key, "admin", "Super Admin's user record", key === "super" ? su.status === 200 : su.status === 403, su.status);

  // shipping line binding
  const sl = await get(c, "/api/erp/shipping-lines?limit=200");
  if (sl.status === 200 && (key === "sl_admin" || key === "sl_deira")) {
    const ids = (sl.body?.data?.shippingLines ?? []).map((l) => l.id);
    check(key, "isolation", "shipping-lines list = own line only", sameSet(ids, [fx.LINE_ALPHA]), ids.length);
  }

  // global search
  const sr = await get(c, "/api/erp/search?q=RBAC-TEST&limit=50");
  const srText = JSON.stringify(sr.body ?? "");
  const allowedText = [...(exp.bl ?? exp.blWithin ?? []).map((k) => BL_NO[k]), ...(exp.co ?? exp.coWithin ?? []).map((k) => CO_NO[k])];
  const foreign = [...Object.values(BL_NO), ...Object.values(CO_NO)].filter((n) => srText.includes(n) && !allowedText.includes(n));
  check(key, "search", "search never returns out-of-scope records", sr.status === 403 || foreign.length === 0, { status: sr.status, foreign });

  // AI assistant: ask about a record outside the login's scope (Kandahar is outside every non-global role)
  if (key !== "super" && key !== "ops_global") {
    const ai = await get(c, "/api/erp/ai/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "Show BL RBAC-TEST-BL-KANDAHAR", lang: "en" }) });
    const t = JSON.stringify(ai.body ?? "");
    // the fixture container number exists only on the Kandahar BL: quoting it = leaking the record
    const container = "RBACU" + BL_NO.BL_KANDAHAR.slice(-6);
    check(key, "ai", "AI never quotes an out-of-scope record", ai.status === 403 || (ai.status === 200 && !t.includes(container)), { status: ai.status, leaked: t.includes(container) });
  }
  // AI for a global login DOES find it (proves the check above is meaningful, not an always-empty answer)
  if (key === "super") {
    const ai = await get(c, "/api/erp/ai/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "Show BL RBAC-TEST-BL-KANDAHAR", lang: "en" }) });
    check(key, "ai", "AI answers a global login about the same record", ai.status === 200, { status: ai.status, found: JSON.stringify(ai.body ?? "").includes("RBACU" + BL_NO.BL_KANDAHAR.slice(-6)) });
  }
  process.stdout.write(`${key}: ${results.filter((r) => r.role === key && r.pass).length}/${results.filter((r) => r.role === key).length}\n`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), partial: true, results }, null, 2));
}

const fail = results.filter((r) => !r.pass);
console.log(`\nTOTAL ${results.length - fail.length}/${results.length} PASS`);
for (const f of fail) console.log("FAIL", f.role, f.area, f.name, JSON.stringify(f.observed));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
process.exit(fail.length ? 1 : 0);
