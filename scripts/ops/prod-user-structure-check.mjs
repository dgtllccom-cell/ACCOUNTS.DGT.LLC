#!/usr/bin/env node
/**
 * LIVE Production check of the final 8-user structure — READ-ONLY (GET requests only). Run ON the production server:
 *   node scripts/ops/prod-user-structure-check.mjs > /tmp/prod-user-structure.json
 * For every retained account it mints a short-lived (~2 h) session with the server's own ERP_SESSION_SECRET (never printed)
 * and lets the LIVE app resolve it exactly as it resolves a login cookie on every request (profile, ban/archive state,
 * active assignments, effective role, scope). It then checks Country + Branch + Business/Shipping scope and the pages / APIs
 * each profile must and must not reach. Disabled accounts must get NO session. Creates nothing, changes nothing.
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
const createdAt = Date.now() - (30 * 24 - 2) * 60 * 60 * 1000;
const mint = (u) => {
  const payload = Buffer.from(JSON.stringify({ v: 1, kind: "temp", userId: u.id, email: u.email, fullName: u.name, roles: [], assignments: [], createdAt })).toString("base64url");
  return `erp_session=${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
};

const PK = "ace69ef9-8c3b-479c-bdb7-7953ddf8629d", AE = "582526d0-0375-41e9-8eba-ccbd2a5e3a0f";
const PK_MAIN = "9e4fab55-ecab-43d1-aef5-061c29d747fc", AE_MAIN = "89bf01e5-9245-4099-b78c-b4476e7bd96b";
const QUETTA = "e99b0fe2-a820-4bb0-b5f8-5e7019b630f7", CHAMAN_SHIP = "fe96248b-1c3f-4706-a78e-3015026fe846", ALRAS = "dace4d8f-34ad-4dc6-99d4-4080c1ce9dd9";

const RETAINED = [
  { key: "global_super", label: "Global Super Admin", id: "be3a6b15-65c5-4d74-82ae-e956c02a5f07", email: "superadmin@dgt.llc",
    expect: { roles: ["super_admin"], isSuperAdmin: true, domains: ["both"], cities: null },
    allow: ["/dashboard/super-admin", "/dashboard/ledger/detailed", "/dashboard/logistics", "/dashboard/users"], deny: [] },
  { key: "business_super", label: "Business Super Admin", id: "00000000-0000-4000-8000-000000000001", email: "business.superadmin@dgt.llc",
    expect: { roles: ["business_super_admin"], isSuperAdmin: false, domains: ["business"], countries: [PK, AE], cities: [QUETTA, ALRAS] },
    allow: ["/dashboard/country", "/dashboard/ledger/detailed", "/dashboard/purchase/new-purchase-booking-order", "/dashboard/new-entry/users/branch", "/dashboard/new-entry/branch-entry/city-branch"],
    deny: ["/dashboard/super-admin", "/dashboard/logistics", "/dashboard/shipping-line/bl-entry", "/api/erp/shipping/bl-records?limit=5"] },
  { key: "shipping_super", label: "Shipping Line Super Admin", id: "22222222-2222-4000-8000-000000000002", email: "shipping.superadmin@dgt.llc",
    expect: { roles: ["shipping_super_admin"], isSuperAdmin: false, domains: ["shipping"], countries: [PK, AE], cities: [CHAMAN_SHIP] },
    allow: ["/dashboard/logistics", "/dashboard/shipping-line/bl-entry", "/dashboard/new-entry/users/branch", "/dashboard/new-entry/branch-entry/city-branch", "/api/erp/shipping/bl-records?limit=5"],
    deny: ["/dashboard/super-admin", "/dashboard/ledger/detailed", "/dashboard/roznamcha/cash-entry", "/dashboard/purchase/new-purchase-booking-order", "/api/erp/purchases/orders?limit=5", "/api/erp/accounting/reports/ledger/general?reportScope=country", "/api/erp/money-exchange"] },
  { key: "pk_country", label: "Pakistan Country Admin", id: "51b1bd43-b8a7-4664-8542-af197aeb8b6f", email: "pakistan.admin@dgt.llc",
    expect: { roles: ["country_admin"], isSuperAdmin: false, domains: ["business"], countries: [PK], cities: [QUETTA, CHAMAN_SHIP] },
    allow: ["/dashboard/country", "/dashboard/ledger/detailed"], deny: ["/dashboard/super-admin", `/api/erp/shipping/bl-records?countryId=${AE}`] },
  { key: "quetta_business", label: "Quetta Business Branch Admin", id: "2ccc050f-ea52-499e-a8f9-167d9de7a246", email: "quetta.branch@dgt.llc",
    expect: { roles: ["city_branch_admin"], isSuperAdmin: false, domains: ["business"], countries: [PK], cities: [QUETTA] },
    allow: ["/dashboard/city", "/dashboard/ledger/detailed"], deny: ["/dashboard/super-admin", "/dashboard/logistics", `/api/erp/money-exchange?branchId=${ALRAS}`] },
  { key: "chaman_shipping", label: "Chaman Shipping Line Branch Admin", id: "9b568b89-5541-450d-b3e5-45053cf7364c", email: "chaman.shipping@dgt.llc",
    expect: { roles: ["shipping_line_admin"], isSuperAdmin: false, domains: ["shipping"], countries: [PK], cities: [CHAMAN_SHIP] },
    allow: ["/dashboard/logistics"], deny: ["/dashboard/super-admin", "/dashboard/ledger/detailed", "/api/erp/expenses"] },
  { key: "uae_country", label: "UAE Country Admin", id: "68318247-a28d-4a2f-a731-877f9d880033", email: "uae.admin@dgt.llc",
    expect: { roles: ["country_admin"], isSuperAdmin: false, domains: ["business"], countries: [AE], cities: [ALRAS] },
    allow: ["/dashboard/country", "/dashboard/ledger/detailed"], deny: ["/dashboard/super-admin", `/api/erp/shipping/bl-records?countryId=${PK}`] },
  { key: "alras_business", label: "Al Ras Business Branch Admin", id: "84644d2f-8f15-4377-9c99-d360da7131de", email: "alras.shipping@dgt.llc",
    expect: { roles: ["city_branch_admin"], isSuperAdmin: false, domains: ["business"], countries: [AE], cities: [ALRAS] },
    allow: ["/dashboard/city", "/dashboard/ledger/detailed"], deny: ["/dashboard/super-admin", "/dashboard/logistics", `/api/erp/money-exchange?branchId=${QUETTA}`] },
];
const DISABLED = [
  { key: "pk_ops", id: "c0216850-7b9c-413b-9eaf-d903019d309b", email: "pk.ops@dgt.llc" },
  { key: "quetta_ops", id: "494454ce-04f9-423a-ae0f-2a1b7639be30", email: "quetta.ops@dgt.llc" },
  { key: "chaman_ops", id: "ebf74539-92f5-4099-a2c4-4bc951cd9a1e", email: "chaman.ops@dgt.llc" },
  { key: "usr7420", id: "3f55c3ba-90fb-4243-8efe-08aa3dccf326", email: "usr7420@dgt.llc" },
];

async function get(cookie, path) {
  try {
    const r = await fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(120000) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, location: r.headers.get("location"), json };
  } catch (e) { return { status: "ERR " + String(e).slice(0, 60) }; }
}
const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
const denied = (r) => r.status === 403 || (r.status === 307 && !/\/auth\/login/.test(r.location || ""));

const accounts = [];
for (const u of RETAINED) {
  const c = mint(u);
  const checks = [];
  const ck = (name, pass, observed) => checks.push({ name, pass: Boolean(pass), observed });
  const s = await get(c, "/api/erp/auth/session");
  const d = s.json?.data ?? {};
  const sc = d.scopes ?? {};
  ck("live session resolves for this account", s.status === 200 && d.user?.id === u.id, s.status);
  ck(`effective role = ${u.expect.roles.join(",")}`, same(d.roles, u.expect.roles), d.roles);
  ck(`Super Admin flag = ${u.expect.isSuperAdmin}`, sc.isSuperAdmin === u.expect.isSuperAdmin, sc.isSuperAdmin);
  if (u.expect.domains[0] === "both") ck("domains = business + shipping", same(sc.operationalDomains, ["business", "shipping", "both"]) || same(sc.operationalDomains, ["business", "shipping"]) || (sc.operationalDomains ?? []).includes("both"), sc.operationalDomains);
  else ck(`domain = ${u.expect.domains[0]} only`, same(sc.operationalDomains, u.expect.domains), sc.operationalDomains);
  if (u.expect.countries) ck("countries = expected", same(sc.countryIds, u.expect.countries), sc.countryIds);
  if (u.expect.cities) ck("branches = expected", same(sc.cityBranchIds, u.expect.cities), sc.cityBranchIds);
  if (!u.expect.isSuperAdmin) ck("no wildcard permission", !(d.permissions ?? []).includes("*:*"), (d.permissions ?? []).length);
  for (const p of u.allow) { const r = await get(c, p); ck(`allowed ${p}`, r.status === 200, r.status); }
  for (const p of u.deny) { const r = await get(c, p); ck(`denied ${p}`, denied(r), r.status); }
  accounts.push({
    account: u.label, email: u.email, roles: d.roles, isSuperAdmin: sc.isSuperAdmin, domains: sc.operationalDomains,
    countries: sc.countryIds, countryBranches: sc.countryBranchIds, branches: sc.cityBranchIds, canViewFinancials: d.canViewFinancials,
    scopeLabel: sc.summary?.scopeLabel ?? null, result: checks.every((x) => x.pass) ? "PASS" : "FAIL", checks,
  });
}
const disabled = [];
for (const u of DISABLED) {
  const r = await get(mint({ ...u, name: "x" }), "/api/erp/auth/session");
  disabled.push({ email: u.email, sessionStatus: r.status, blocked: r.status !== 200 || !r.json?.data?.user?.id });
}
console.log(JSON.stringify({ at: new Date().toISOString(), accounts, disabled }, null, 2));
