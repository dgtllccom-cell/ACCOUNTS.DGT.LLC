/** DEV only — Country/branch scoping + totals of /api/erp/reports/scoped & meta. BASE=http://localhost:3510 node scripts/dev/country-reports-api-audit.mjs */
const BASE = process.env.BASE || "http://localhost:3510"; if (!/localhost/.test(BASE)) throw new Error("DEV only");
const results = []; const check = (n, ok, d = "") => { results.push({ n, ok: !!ok }); console.log(ok ? "PASS" : "FAIL", n, d ? "· " + String(d).slice(0, 230) : ""); };
const sess = async (b) => { const r = await fetch(BASE + "/api/erp/auth/dev-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return r.headers.getSetCookie().map((x) => x.split(";")[0]).find((x) => x.startsWith("erp_session=")); };
const api = (cookie) => async (p) => { const x = await fetch(BASE + p, { headers: { cookie }, redirect: "manual" }); let j = null; try { j = await x.json(); } catch {} return { status: x.status, j }; };
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14", AE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const PKCB = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa", PKCITY = "7d7d42fe-ddd1-4bec-8703-3911ad14fa8b";
const sa = api(await sess({ role: "super_admin" }));
const types = ["roznamcha", "ledger", "purchase", "sales", "payment", "remaining", "journal", "cash", "inventory", "transfer", "loading", "exchange-rate", "daily-comprehensive", "purchase-booking", "user-activity"];

// every report type loads for super admin
for (const t of types) { const r = await sa(`/api/erp/reports/scoped?reportType=${t}&limit=50`); check(`super admin: ${t} loads`, r.status === 200 && r.j?.ok, `${r.status} ${r.j?.error?.message || ""}`); }
const meta = await sa("/api/erp/reports/meta?lang=en"); check("meta loads (super admin)", meta.status === 200 && meta.j?.ok, `${meta.status} ${meta.j?.error?.message || ""}`);

// scope enforcement
const ca = api(await sess({ role: "country_admin", countryId: PK }));
const cr = await ca("/api/erp/reports/scoped?reportType=ledger&limit=500");
check("country admin PK: ledger loads", cr.status === 200 && cr.j?.ok, `${cr.status} ${cr.j?.error?.message || ""}`);
const rows = cr.j?.data?.rows ?? cr.j?.data?.data ?? [];
console.log("INFO rows keys:", Object.keys(cr.j?.data || {}).join(","));
const forced = await ca(`/api/erp/reports/scoped?reportType=ledger&countryId=${AE}&limit=50`);
check("country admin asking for ANOTHER country is refused or clamped to own", forced.status === 403 || (forced.j?.data?.scope?.enforced?.countryId ?? PK) === PK, `${forced.status} enforced=${JSON.stringify(forced.j?.data?.scope?.enforced)}`);
const ba = api(await sess({ role: "city_branch_admin", countryId: PK, countryBranchId: PKCB, cityBranchId: PKCITY }));
const br = await ba("/api/erp/reports/scoped?reportType=ledger&limit=500");
check("city branch admin: loads", br.status === 200 && br.j?.ok, `${br.status} ${br.j?.error?.message || ""}`);
check("city branch admin: enforced to own branch", br.j?.data?.scope?.enforced?.branchId === PKCITY || br.j?.data?.scope?.enforced?.branchId === PKCB, JSON.stringify(br.j?.data?.scope?.enforced));
const bo = await ba(`/api/erp/reports/scoped?reportType=ledger&countryId=${AE}&limit=50`);
check("city branch admin asking for another country: refused/clamped", bo.status === 403 || (bo.j?.data?.scope?.enforced?.countryId ?? PK) === PK, `${bo.status} ${JSON.stringify(bo.j?.data?.scope?.enforced)}`);
const st = api(await sess({ role: "staff_user", countryId: PK, countryBranchId: PKCB, cityBranchId: PKCITY }));
const sr = await st("/api/erp/reports/scoped?reportType=ledger&limit=50");
check("staff_user without report permission: clean 403 (no crash)", sr.status === 403, `${sr.status} ${sr.j?.error?.message || ""}`);
const anon = await fetch(BASE + "/api/erp/reports/scoped?reportType=ledger", { redirect: "manual" });
check("no session → no data", [401, 307, 403].includes(anon.status), anon.status);

// totals: per-currency totals must equal the sum of that currency's rows (AED + PKR + USD are never added together)
const lg = await sa("/api/erp/reports/scoped?reportType=ledger&limit=500");
const rows2 = lg.j?.data?.data ?? [];
const bc = lg.j?.data?.summary?.byCurrency ?? {};
const cur = [...new Set(rows2.map((r) => String(r.currency).toUpperCase()))];
check("summary.byCurrency covers every currency present in the rows", cur.every((c) => bc[c]) && Object.keys(bc).length === cur.length, "rows=" + rows2.length + " currencies=" + cur.join(","));
check("each currency's debit/credit total equals the sum of its own rows", cur.every((c) => Math.abs(bc[c].debit - rows2.filter((r) => String(r.currency).toUpperCase() === c).reduce((a, r) => a + r.debit, 0)) < 0.01 && Math.abs(bc[c].credit - rows2.filter((r) => String(r.currency).toUpperCase() === c).reduce((a, r) => a + r.credit, 0)) < 0.01));
check("mixedCurrency flag is set exactly when more than one currency is present", Boolean(lg.j?.data?.summary?.mixedCurrency) === (cur.length > 1), "currencies=" + cur.length);

// Shipping-only / Operations logins: every report type offered by meta must actually be allowed by the API
for (const [role, dom] of [["country_admin", "shipping"], ["main_branch_admin", "shipping"], ["city_branch_admin", "shipping"], ["country_admin", "business"], ["country_admin", "both"]]) {
  const x = api(await sess({ role, countryId: AE, operationalDomain: dom }));
  const m = await x("/api/erp/reports/meta?lang=en"); const types = (m.j?.data?.reportTypes || []).map((t) => t.key);
  let denied = 0; for (const t of types) { const r = await x(`/api/erp/reports/scoped?reportType=${t}&limit=20`); if (r.status !== 200) denied++; }
  check(`${role}/${dom}: all ${types.length} offered report types are permitted (no 403 on first load)`, denied === 0 && (dom !== "shipping" || types.every((t) => t === "loading")), `denied=${denied} types=${types.slice(0, 3)}`);
  if (dom === "shipping") { const b = await x("/api/erp/reports/scoped?reportType=cash-entry&limit=5"); check(`${role}/shipping: Business report type still refused by the API`, b.status === 403, String(b.status)); }
}
console.log(`
${results.filter((x) => x.ok).length}/${results.length} passed`);
