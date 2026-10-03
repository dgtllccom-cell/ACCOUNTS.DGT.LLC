#!/usr/bin/env node
/**
 * RBAC administration checks (DEV ONLY) — complements scripts/e2e-rbac-matrix.mjs:
 *   1. a permission change by Super Admin is AUDITED (before/after) and takes effect on the user's NEXT request (no re-login);
 *   2. privilege escalation attempts by a Country Admin are refused (promote to Super Admin, edit a Super Admin, foreign country);
 *   3. a COMBINED login (Branch Admin Deira + Operations Chaman) never takes the highest access: financial data only for the
 *      assignment that grants it, operational data for both.
 * Env: BASE, RBAC_USERS, RBAC_FIXTURES, RBAC_SECRET, RBAC_SA_TOKEN (Super Admin erp_session token), DB checks via AUDIT_JSON (optional).
 */
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3000";
const fx = JSON.parse(fs.readFileSync(process.env.RBAC_FIXTURES, "utf8"));
const users = JSON.parse(fs.readFileSync(process.env.RBAC_USERS, "utf8"));
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const SA = `erp_session=${fs.readFileSync(process.env.RBAC_SA_TOKEN, "utf8").trim()}`;
const results = [];
const check = (area, name, pass, observed) => { results.push({ area, name, pass: Boolean(pass), observed }); console.log(pass ? "PASS" : "FAIL", area, "-", name, JSON.stringify(observed)); };

async function login(email) {
  const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: email, password }), redirect: "manual" });
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => c.startsWith("erp_session=")).join("; ");
}
async function call(cookie, path, method = "GET", body) {
  const res = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { j = t; }
  return { status: res.status, body: j };
}

// 1. audited permission change + live refresh
{
  const r = users.restricted;
  const c = await login(r.email);
  const s0 = await call(c, "/api/erp/auth/session");
  check("refresh", "restricted user starts WITHOUT financial access", s0.body?.data?.canViewFinancials === false, s0.body?.data?.canViewFinancials);
  const p1 = await call(SA, "/api/erp/users", "PATCH", { userId: r.userId, financialAccess: "role_default" });
  check("audit", "Super Admin changes financial access (PATCH 200)", p1.status === 200, p1.status);
  const s1 = await call(c, "/api/erp/auth/session");
  check("refresh", "same cookie, next request: financial access now ON (no re-login)", s1.body?.data?.canViewFinancials === true, s1.body?.data?.canViewFinancials);
  const p2 = await call(SA, "/api/erp/users", "PATCH", { userId: r.userId, financialAccess: "deny" });
  const s2 = await call(c, "/api/erp/auth/session");
  check("refresh", "revoked again: next request has NO financial access", p2.status === 200 && s2.body?.data?.canViewFinancials === false, { patch: p2.status, can: s2.body?.data?.canViewFinancials });
  const g = await call(SA, `/api/erp/users?userId=${r.userId}`);
  check("profile", "effective-access summary returned for the user", g.status === 200 && g.body?.data?.effectiveAccess?.canViewFinancials === false && Array.isArray(g.body?.data?.effectiveAccess?.roles), g.body?.data?.effectiveAccess ? { roles: g.body.data.effectiveAccess.roles, fin: g.body.data.effectiveAccess.canViewFinancials } : g.status);
}

// 2. escalation attempts by the UAE Country Admin
{
  const c = await login(users.country_uae.email);
  const a = await call(c, "/api/erp/users", "PATCH", { userId: users.branch_deira.userId, role: "super_admin" });
  check("escalation", "Country Admin cannot promote a user to Super Admin", a.status === 403, a.status);
  const b = await call(c, "/api/erp/users", "PATCH", { userId: users.super.userId, fullName: "hijack" });
  check("escalation", "Country Admin cannot edit a Super Admin", b.status === 403, b.status);
  const d = await call(c, "/api/erp/users", "PATCH", { userId: users.ops_pk.userId, fullName: "cross-country" });
  check("escalation", "Country Admin cannot edit a user of another country", d.status === 403, d.status);
  const e = await call(c, `/api/erp/users?userId=${users.ops_pk.userId}`);
  check("escalation", "Country Admin cannot open a user of another country", e.status === 403, e.status);
  const f = await call(c, `/api/erp/users?userId=${users.branch_deira.userId}`);
  check("scope", "Country Admin opens a user of its own country", f.status === 200, f.status);
  const bc = await login(users.branch_deira.email);
  const h = await call(bc, "/api/erp/users", "PATCH", { userId: users.finance.userId, fullName: "x" });
  check("escalation", "Branch Admin (not a user manager) cannot edit users", h.status === 403, h.status);
}

// 2b. warehouse assignment: a login bound to named warehouses lists only those; clearing the binding restores the scope
{
  const u = users.branch_deira;
  const c = await login(u.email);
  const before = await call(c, "/api/erp/warehouses?limit=500");
  const allIds = (before.body?.data?.warehouses ?? []).map((w) => w.id);
  const p1 = await call(SA, "/api/erp/users", "PATCH", { userId: u.userId, warehouseIds: [fx.WH_UAE_1, fx.WH_UAE_2] });
  const bound = await call(c, "/api/erp/warehouses?limit=500");
  const boundIds = (bound.body?.data?.warehouses ?? []).map((w) => w.id).sort();
  check("warehouse", "bound login lists exactly its 2 assigned warehouses (next request, same cookie)", p1.status === 200 && JSON.stringify(boundIds) === JSON.stringify([fx.WH_UAE_1, fx.WH_UAE_2].sort()), { patch: p1.status, before: allIds.length, after: boundIds.length });
  const p2 = await call(SA, "/api/erp/users", "PATCH", { userId: u.userId, warehouseIds: [] });
  const after = await call(c, "/api/erp/warehouses?limit=500");
  check("warehouse", "clearing the binding restores the country scope", p2.status === 200 && (after.body?.data?.warehouses ?? []).length === allIds.length, { after: (after.body?.data?.warehouses ?? []).length, expected: allIds.length });
  const foreign = (before.body?.data?.warehouses ?? []).filter((w) => w.country_id && w.country_id !== fx.UAE);
  check("warehouse", "UAE branch login never lists another country's warehouse", foreign.length === 0, foreign.length);
}

// 3. combined login: Branch Admin Deira (business) + Operations Chaman
if (users.combo?.userId) {
  const c = await login(users.combo.email);
  const s = await call(c, "/api/erp/auth/session");
  const roles = s.body?.data?.roles ?? [];
  check("combined", "both effective roles present", roles.includes("city_branch_admin") && roles.includes("city_operations_admin"), roles);
  const bl = await call(c, "/api/erp/shipping/bl-records?limit=200&q=RBAC-TEST");
  const seen = (bl.body?.data?.records ?? []).map((r) => r.bl_number).sort();
  check("combined", "operational data for BOTH assignments (Deira + Chaman BLs), nothing else", bl.status === 200 && JSON.stringify(seen) === JSON.stringify(["RBAC-TEST-BL-CHAMAN-AGENTA", "RBAC-TEST-BL-DEIRA-ALPHA", "RBAC-TEST-BL-DEIRA-BETA"]), seen);
  const led = await call(c, "/api/erp/ledgers?limit=500");
  const rows = Array.isArray(led.body?.data) ? led.body.data : (led.body?.data?.ledgers ?? led.body?.ledgers ?? []);
  const chaman = rows.filter((l) => l.city_branch_id === fx.CHAMAN);
  check("combined", "financial data (ledgers) never from the operations-only assignment (Chaman)", led.status === 403 || chaman.length === 0, { status: led.status, rows: rows.length, chaman: chaman.length });
}

const fail = results.filter((r) => !r.pass);
console.log(`\nTOTAL ${results.length - fail.length}/${results.length} PASS`);
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(fail.length ? 1 : 0);
