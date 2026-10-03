#!/usr/bin/env node
/**
 * LIVE Production verification — READ-ONLY (GET requests + 404 probes). Run ON the production server:
 *   node scripts/ops/prod-live-check.mjs > /tmp/prod-live-check.json
 * Mints short-lived (≈2 h) sessions for EXISTING users with the server's own ERP_SESSION_SECRET (never printed), then checks
 * pages / APIs per role against http://localhost:3000. Creates no users, no records, no transactions.
 */
import fs from "node:fs";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";
const secret = (() => {
  for (const f of [".env.local", ".env"]) {
    try {
      const m = fs.readFileSync(f, "utf8").match(/^\s*(?:ERP_SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET)\s*=\s*(.+)\s*$/m);
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, "");
    } catch {}
  }
  throw new Error("no session secret");
})();
// server accepts a token for 30 days from createdAt: backdate so this one lives ~2 hours only
const createdAt = Date.now() - (30 * 24 - 2) * 60 * 60 * 1000;
const mint = (u) => {
  const payload = Buffer.from(JSON.stringify({ v: 1, kind: "temp", userId: u.id, email: u.email, fullName: u.name, roles: [u.role], assignments: [], createdAt })).toString("base64url");
  return `erp_session=${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
};

const PK = "ace69ef9-8c3b-479c-bdb7-7953ddf8629d", AE = "582526d0-0375-41e9-8eba-ccbd2a5e3a0f";
const QUETTA = "e99b0fe2-a820-4bb0-b5f8-5e7019b630f7", CHAMAN = "6eeb30a9-dd15-4d61-943b-e51a48b12127", ALRAS = "dace4d8f-34ad-4dc6-99d4-4080c1ce9dd9";
const U = {
  super: { id: "be3a6b15-65c5-4d74-82ae-e956c02a5f07", email: "superadmin@dgt.llc", name: "Super Admin", role: "super_admin" },
  pk_admin: { id: "51b1bd43-b8a7-4664-8542-af197aeb8b6f", email: "pakistan.admin@dgt.llc", name: "PK Admin", role: "country_admin" },
  pk_ops: { id: "c0216850-7b9c-413b-9eaf-d903019d309b", email: "pk.ops@dgt.llc", name: "PK Ops", role: "country_admin" },
  uae_admin: { id: "68318247-a28d-4a2f-a731-877f9d880033", email: "uae.admin@dgt.llc", name: "UAE Admin", role: "country_admin" },
  chaman_admin: { id: "5785e55c-7937-43c9-851f-4669b097296c", email: "chaman.branch@dgt.llc", name: "Chaman Admin", role: "city_branch_admin" },
  quetta_ops: { id: "494454ce-04f9-423a-ae0f-2a1b7639be30", email: "quetta.ops@dgt.llc", name: "Quetta Ops", role: "city_branch_admin" },
  chaman_entry: { id: "fb907ed5-dd4a-4169-b10c-a01d3b9b4692", email: "usr9261@dgt.llc", name: "Chaman entry", role: "staff_user" },
  chaman_ship: { id: "9b568b89-5541-450d-b3e5-45053cf7364c", email: "chaman.shipping@dgt.llc", name: "Chaman Ship", role: "city_branch_admin" },
  agent: { id: "3f55c3ba-90fb-4243-8efe-08aa3dccf326", email: "usr7420@dgt.llc", name: "Agent", role: "agent_user" },
  alras_admin: { id: "84644d2f-8f15-4377-9c99-d360da7131de", email: "alras.shipping@dgt.llc", name: "Al Ras Admin", role: "city_branch_admin" },
};

const results = [];
const check = (who, area, name, pass, observed) => results.push({ who, area, name, pass: Boolean(pass), observed });
async function get(cookie, path, method = "GET") {
  try {
    const r = await fetch(BASE + path, { method, headers: cookie ? { cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(120000) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, location: r.headers.get("location"), json, text };
  } catch (e) { return { status: "ERR " + String(e).slice(0, 50) }; }
}
const rows = (j) => { const d = j?.data ?? j; for (const k of ["records", "rows", "orders", "entries", "bills", "purchaseOrders", "loads", "items"]) if (Array.isArray(d?.[k])) return d[k].length; if (Array.isArray(d)) return d.length; return null; };

// 1. anonymous: nothing opens, demo/preview paths are gone
for (const p of ["/dashboard", "/dashboard/ledger/detailed", "/api/erp/money-exchange", "/api/erp/shipping/bl-records", "/api/erp/users?userId=" + U.super.id]) {
  const r = await get(null, p);
  check("anonymous", "auth", `no session → no data ${p}`, [307, 401, 403].includes(r.status), r.status);
}
check("anonymous", "demo", "anonymous ERP preview retired", (await get(null, "/api/erp/auth/preview", "POST")).status === 404, null);
check("anonymous", "demo", "passwordless dev-session disabled", (await get(null, "/api/erp/auth/dev-session", "POST")).status === 404, null);

// 2. Super Admin: every module opens and lists ZERO transactions
const sa = mint(U.super);
const ses = await get(sa, "/api/erp/auth/session");
check("super", "session", "Super Admin session resolves", ses.status === 200 && (ses.json?.data?.roles ?? []).includes("super_admin"), ses.json?.data?.roles);
for (const p of ["/dashboard/super-admin", "/dashboard/purchase/purchase-loading-records", "/dashboard/purchase/purchase-transit-lane", "/dashboard/sales", "/dashboard/purchase", "/dashboard/roznamcha/cash-entry", "/dashboard/ledger/detailed", "/dashboard/ledger/general-report", "/dashboard/roznamcha/money-exchange", "/dashboard/logistics", "/dashboard/users", "/dashboard/reports"]) {
  const r = await get(sa, p);
  check("super", "pages", `opens ${p}`, r.status === 200 || (r.status === 307 && /\/dashboard/.test(r.location || "")), r.status);
}
check("super", "demo", "demo quotation page gone", (await get(sa, "/dashboard/sales/quotation-demo")).status === 404, null);
for (const [name, p] of [["loading records", "/api/erp/purchases/loading-records?limit=50"], ["transit & lane", "/api/erp/purchases/lane"], ["BL records", "/api/erp/shipping/bl-records?limit=50"], ["customer orders", "/api/erp/clearing-agent/customer-order"], ["money exchange", "/api/erp/money-exchange?limit=50"], ["expense bills", "/api/erp/expenses?limit=50"], ["temp/arzi bills", "/api/erp/temp-bills"]]) {
  const r = await get(sa, p);
  const n = rows(r.json);
  check("super", "zero-state", `${name}: 0 rows`, r.status === 200 && (n === 0 || n === null), { status: r.status, rows: n });
}
const gen = await get(sa, "/api/erp/accounting/reports/ledger/general?reportScope=super_admin");
check("super", "zero-state", "ledger general report: 0 entries", gen.status === 200 && Number(gen.json?.data?.summary?.entries ?? 0) === 0, { status: gen.status, entries: gen.json?.data?.summary?.entries });

// 3. roles: isolation + financial restrictions (server/API, not menus)
const deny = async (who, path, why) => { const r = await get(mint(U[who]), path); check(who, "rbac", `${why} ${path}`, r.status === 403 || (r.status === 307 && !/super-admin/.test(r.location || "")), r.status); };
const allow = async (who, path, why) => { const r = await get(mint(U[who]), path); check(who, "rbac", `${why} ${path}`, r.status === 200, r.status); };
await deny("pk_admin", "/dashboard/super-admin", "country admin: global dashboard blocked");
await deny("pk_admin", `/api/erp/shipping/bl-records?countryId=${AE}`, "PK admin: UAE data 403");
await allow("pk_admin", "/dashboard/ledger/detailed", "PK admin: ledger allowed");
await deny("pk_ops", "/dashboard/ledger/detailed", "operations: ledger 403");
await deny("pk_ops", "/api/erp/money-exchange", "operations: money exchange 403");
await deny("pk_ops", "/api/erp/accounting/reports/ledger/ledgers?reportScope=country", "operations: ledger API 403");
await allow("pk_ops", "/dashboard/logistics", "operations: logistics allowed");
await deny("quetta_ops", "/dashboard/roznamcha/cash-entry", "Quetta ops: cash entry 403");
await deny("chaman_admin", `/api/erp/money-exchange?branchId=${QUETTA}`, "Chaman admin: Quetta money exchange 403");
await deny("chaman_admin", "/dashboard/super-admin", "Chaman admin: global dashboard blocked");
await deny("chaman_ship", "/dashboard/ledger/detailed", "shipping line: ledger 403");
await deny("chaman_ship", "/api/erp/expenses", "shipping line: expenses 403");
await deny("agent", "/api/erp/money-exchange", "clearing agent: money exchange 403");
await deny("agent", "/dashboard/accounts", "clearing agent: accounts 403");
await deny("alras_admin", `/api/erp/money-exchange?branchId=${CHAMAN}`, "Al Ras admin: Chaman data 403");
await deny("uae_admin", `/api/erp/shipping/bl-records?countryId=${PK}`, "UAE admin: Pakistan data 403");
const sl = await get(mint(U.chaman_ship), "/api/erp/shipping-lines?limit=50");
const lineIds = (sl.json?.data?.shippingLines ?? []).map((l) => l.id);
check("chaman_ship", "rbac", "shipping-lines list = own line only", sl.status === 200 && lineIds.length === 1 && lineIds[0] === "d122bcf3-4f2e-4db3-b564-15a50cdd74bb", lineIds);
const alrasSes = await get(mint(U.alras_admin), "/api/erp/auth/session");
check("alras_admin", "rbac", "Al Ras admin is a business (not shipping) login", alrasSes.status === 200 && JSON.stringify(alrasSes.json?.data?.scopes?.operationalDomains ?? []) === '["business"]', alrasSes.json?.data?.scopes?.operationalDomains);
const ent = await get(mint(U.chaman_entry), "/api/erp/auth/session");
check("chaman_entry", "rbac", "Chaman data-entry user scoped to Chaman only", ent.status === 200 && JSON.stringify(ent.json?.data?.scopes?.cityBranchIds) === JSON.stringify([CHAMAN]), ent.json?.data?.scopes?.cityBranchIds);

// 4. five languages render (RTL for ur/ar/fa/ps) on the live landing dashboard
for (const lang of ["en", "ur", "ar", "fa", "ps"]) {
  const r = await get(`${sa}; erp_lang=${lang}`, "/dashboard/super-admin");
  const rtl = lang === "en" ? /<html[^>]*dir="rtl"/.test(r.text || "") : /dir="rtl"/.test(r.text || "");
  check("super", "i18n", `dashboard renders in ${lang}`, r.status === 200 && (lang === "en" ? !rtl : rtl), { status: r.status, rtl });
}
const fail = results.filter((r) => !r.pass);
console.log(JSON.stringify({ at: new Date().toISOString(), total: results.length, passed: results.length - fail.length, failed: fail, results }, null, 2));
