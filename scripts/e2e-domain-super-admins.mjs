#!/usr/bin/env node
/**
 * Business / Shipping Line Super Admin separation checks (DEV ONLY). Real login, real pages, real APIs.
 *   - the Global Super Admin creates the two domain super admins through POST /api/erp/users (super_admin + domain)
 *   - each logs in and gets ITS domain's branches only, no wildcard, no Super Admin console
 *   - Business SA: business pages/APIs yes, Shipping & Clearing no; Shipping SA: shipping yes, finance/business no
 *   - each creates / opens / archives branch users of its own domain only; cross-domain and Global-only roles are refused
 *   - branch creation is limited to the login's own domain
 *   - a deactivated account cannot log in
 * Env: BASE, RBAC_USERS, RBAC_FIXTURES, RBAC_SECRET, RBAC_SA_TOKEN, DSA_STATE (json file for created ids), OUT (json)
 */
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3000";
const fx = JSON.parse(fs.readFileSync(process.env.RBAC_FIXTURES, "utf8"));
const users = JSON.parse(fs.readFileSync(process.env.RBAC_USERS, "utf8"));
const { password } = JSON.parse(fs.readFileSync(process.env.RBAC_SECRET, "utf8"));
const SA = `erp_session=${fs.readFileSync(process.env.RBAC_SA_TOKEN, "utf8").trim()}`;
const STATE = process.env.DSA_STATE;
const state = STATE && fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
const CHAMAN_SHIP = "ccb85723-e596-4ae8-8bc1-b10f60703197";
const results = [];
const check = (area, name, pass, observed) => { results.push({ area, name, pass: Boolean(pass), observed }); console.log(pass ? "PASS" : "FAIL", area, "-", name, JSON.stringify(observed)); };

async function loginRaw(email) {
  const res = await fetch(BASE + "/api/erp/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: email, password }), redirect: "manual", signal: AbortSignal.timeout(120000) });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter((c) => c.startsWith("erp_session=")).join("; ");
  return { status: res.status, cookie };
}
async function call(cookie, path, method = "GET", body) {
  const res = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(180000) });
  const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { j = t; }
  return { status: res.status, body: j, location: res.headers.get("location") };
}
const deniedPage = (r) => r.status === 403 || (r.status === 307 && !String(r.location || "").includes("/auth/login"));

// 0. the Global Super Admin creates the two domain super admins (once; ids kept in DSA_STATE)
const PROFILES = [
  { key: "biz_super", email: "rbac.biz.super@rbac-test.dev", domain: "business", label: "Business Super Admin" },
  { key: "ship_super", email: "rbac.ship.super@rbac-test.dev", domain: "shipping", label: "Shipping Line Super Admin" },
];
for (const p of PROFILES) {
  if (state[p.key]) continue;
  const r = await call(SA, "/api/erp/users", "POST", { role: "super_admin", operationalDomain: p.domain, fullName: `RBAC-TEST ${p.label}`, email: p.email, password, userCode: `RBAC-${p.key.toUpperCase().replace(/_/g, "-")}`, preferredLanguage: "en", mobileProfile: "standard" });
  check("setup", `Global SA creates ${p.label} (201)`, r.status === 201 && r.body?.data?.email === p.email, { status: r.status, email: r.body?.data?.email, err: r.body?.error });
  if (r.status === 201) state[p.key] = { userId: r.body.data.userId, email: r.body.data.email };
}
if (STATE) fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
// the Global Super Admin stays global
{
  const s = await call(SA, "/api/erp/auth/session");
  check("global", "Global Super Admin session: super_admin + every domain", (s.body?.data?.roles ?? []).includes("super_admin") && s.body?.data?.isGlobalScope === true, { roles: s.body?.data?.roles });
}

const BIZ_CITIES = [fx.QUETTA, fx.CHAMAN, fx.DEIRA];
const SHIP_CITIES = [CHAMAN_SHIP, fx.ALRAS, fx.KANDAHAR];

for (const p of PROFILES) {
  const isBiz = p.domain === "business";
  const tag = isBiz ? "business-SA" : "shipping-SA";
  const lg = await loginRaw(p.email);
  check(tag, "real login succeeds", lg.status === 200 && lg.cookie.includes("erp_session="), lg.status);
  if (!lg.cookie) continue;
  const c = lg.cookie;
  const s = await call(c, "/api/erp/auth/session");
  const d = s.body?.data ?? {};
  const cities = d.scopes?.cityBranchIds ?? [];
  check(tag, `effective role is ${isBiz ? "business_super_admin" : "shipping_super_admin"} (not super_admin)`, (d.roles ?? []).join() === (isBiz ? "business_super_admin" : "shipping_super_admin"), d.roles);
  check(tag, "no wildcard permission", !(d.permissions ?? []).includes("*:*"), (d.permissions ?? []).length);
  check(tag, "not global scope", d.isGlobalScope === false, d.isGlobalScope);
  check(tag, `holds every ${p.domain} branch`, (isBiz ? BIZ_CITIES : SHIP_CITIES).every((id) => cities.includes(id)), cities.length);
  check(tag, `holds no ${isBiz ? "shipping" : "business"} branch`, !(isBiz ? SHIP_CITIES : BIZ_CITIES).some((id) => cities.includes(id)), cities.length);
  check(tag, `financial amounts ${isBiz ? "visible" : "hidden"}`, d.canViewFinancials === isBiz, d.canViewFinancials);

  // landing + pages
  const land = await call(c, "/dashboard");
  const loc = (land.location || "").replace(BASE, "").split("?")[0];
  check(tag, `landing = ${isBiz ? "/dashboard/country" : "/dashboard/logistics"}`, loc === (isBiz ? "/dashboard/country" : "/dashboard/logistics"), loc);
  const landPage = await call(c, isBiz ? "/dashboard/country" : "/dashboard/logistics");
  check(tag, "landing page renders 200", landPage.status === 200, landPage.status);
  for (const pg of ["/dashboard/super-admin", "/dashboard/new-entry/users/super-admin", "/dashboard/new-entry/branches/super-admin"]) {
    check(tag, `Global-only page denied ${pg}`, deniedPage(await call(c, pg)), null);
  }
  for (const pg of ["/dashboard/new-entry/users/registration", "/dashboard/new-entry/branch-entry/city-branch", "/dashboard/users"]) {
    const r = await call(c, pg);
    check(tag, `user/branch management page opens ${pg}`, r.status === 200, r.status);
  }
  const bizPages = ["/dashboard/ledger/detailed", "/dashboard/roznamcha/cash-entry", "/dashboard/purchase/new-purchase-booking-order"];
  const shipPages = ["/dashboard/shipping-line/bl-entry", "/dashboard/logistics"];
  for (const pg of bizPages) {
    const r = await call(c, pg);
    check(tag, `${isBiz ? "business page opens" : "business/finance page denied"} ${pg}`, isBiz ? r.status === 200 : deniedPage(r), r.status);
  }
  for (const pg of shipPages) {
    const r = await call(c, pg);
    check(tag, `${isBiz ? "shipping page denied" : "shipping page opens"} ${pg}`, isBiz ? deniedPage(r) : r.status === 200, r.status);
  }

  // APIs
  const purchases = await call(c, "/api/erp/purchases/orders?limit=5");
  check(tag, `purchase API ${isBiz ? "200" : "refused"}`, isBiz ? purchases.status === 200 : purchases.status === 403, purchases.status);
  const ledger = await call(c, "/api/erp/accounting/reports/ledger/general?reportScope=country");
  check(tag, `ledger report API ${isBiz ? "200" : "refused"}`, isBiz ? ledger.status === 200 : ledger.status === 403, ledger.status);
  const bl = await call(c, "/api/erp/shipping/bl-records?limit=50&q=RBAC-TEST");
  check(tag, `BL records API ${isBiz ? "refused" : "200"}`, isBiz ? bl.status === 403 : bl.status === 200, bl.status);
  const su = await call(c, `/api/erp/users?userId=${users.super.userId}`);
  check(tag, "cannot open the Global Super Admin user", su.status === 403, su.status);
  const peer = await call(c, `/api/erp/users?userId=${state[isBiz ? "ship_super" : "biz_super"]?.userId}`);
  check(tag, "cannot open the other domain's Super Admin", peer.status === 403, peer.status);
  const country = await call(c, `/api/erp/users?userId=${users.country_uae.userId}`);
  check(tag, "cannot open a Country Admin", country.status === 403, country.status);
  const otherDomainUser = await call(c, `/api/erp/users?userId=${isBiz ? users.agent.userId : users.finance.userId}`);
  check(tag, `cannot open a ${isBiz ? "shipping" : "business"} user`, otherDomainUser.status === 403, otherDomainUser.status);
  if (isBiz) {
    const own = await call(c, `/api/erp/users?userId=${users.finance.userId}`);
    check(tag, "opens a business branch user (Deira accountant)", own.status === 200, own.status);
  }
  for (const [name, body] of [
    ["promote to Super Admin", { role: "super_admin", operationalDomain: p.domain }],
    ["create a Country Admin", { role: "country_admin", operationalDomain: p.domain, countryId: fx.PK }],
    ["create a user in the other domain", { role: "staff_user", operationalDomain: isBiz ? "shipping" : "business", countryId: fx.PK, countryBranchId: fx.PK_MAIN, cityBranchId: isBiz ? CHAMAN_SHIP : fx.QUETTA }],
    ["create a 'both' domain user", { role: "staff_user", operationalDomain: "both", countryId: fx.PK, countryBranchId: fx.PK_MAIN, cityBranchId: isBiz ? fx.QUETTA : CHAMAN_SHIP }],
    ["place an own-domain user in the other domain's branch", { role: "staff_user", operationalDomain: p.domain, countryId: fx.PK, countryBranchId: fx.PK_MAIN, cityBranchId: isBiz ? CHAMAN_SHIP : fx.QUETTA }],
  ]) {
    const r = await call(c, "/api/erp/users", "POST", { ...body, fullName: "RBAC-TEST refused", email: `rbac.refused.${Date.now()}@rbac-test.dev`, password, preferredLanguage: "en", mobileProfile: "standard" });
    check(tag, `refused: ${name}`, r.status === 403, { status: r.status, err: r.body?.error?.message ?? r.body?.error });
  }
  const editOther = await call(c, "/api/erp/users", "PATCH", { userId: isBiz ? users.sl_deira.userId : users.finance.userId, fullName: "RBAC-TEST cross-domain edit" });
  check(tag, "refused: edit a user of the other domain", editOther.status === 403, editOther.status);

  // own-domain user lifecycle: create -> open -> login -> deactivate -> login refused -> archive
  const email = `rbac.${p.key}.child.${Date.now()}@rbac-test.dev`;
  const childBody = isBiz
    ? { role: "staff_user", operationalDomain: "business", countryId: fx.UAE, countryBranchId: fx.UAE_MAIN, cityBranchId: fx.DEIRA }
    : { role: "staff_user", operationalDomain: "shipping", countryId: fx.PK, countryBranchId: fx.PK_MAIN, cityBranchId: CHAMAN_SHIP, accessProfile: "shipping_line", shippingLineId: fx.LINE_ALPHA };
  const cr = await call(c, "/api/erp/users", "POST", { ...childBody, fullName: `RBAC-TEST ${p.label} child`, email, password, preferredLanguage: "en", mobileProfile: "standard" });
  check(tag, "creates a user in its own domain branch (201)", cr.status === 201, { status: cr.status, err: cr.body?.error?.message ?? cr.body?.error });
  const childId = cr.body?.data?.userId;
  if (childId) {
    const g = await call(c, `/api/erp/users?userId=${childId}`);
    const ea = g.body?.data?.effectiveAccess;
    check(tag, "opens its new user; issued permissions stay inside its own domain", g.status === 200 && !(ea?.permissions ?? []).includes("*:*")
      && (isBiz ? !(ea?.permissions ?? []).some((x) => x.startsWith("shipping_records:")) : !(ea?.permissions ?? []).some((x) => /^(purchases|ledgers|roznamcha|accounts):/.test(x))),
      { status: g.status, roles: ea?.roles, n: (ea?.permissions ?? []).length });
    const l1 = await loginRaw(cr.body.data.email);
    check(tag, "the new user can log in", l1.status === 200 && l1.cookie.includes("erp_session="), l1.status);
    const off = await call(c, "/api/erp/users", "PATCH", { userId: childId, isActive: false });
    check(tag, "deactivates its own user", off.status === 200, off.status);
    const l2 = await loginRaw(cr.body.data.email);
    check(tag, "a deactivated user cannot log in", l2.status === 403 && !l2.cookie, l2.status);
    if (l1.cookie) {
      const old = await call(l1.cookie, "/api/erp/auth/session");
      check(tag, "the deactivated user's existing session is revoked on its next request", old.status === 401 || old.status === 307 || old.status === 403, old.status);
    }
    const del = await call(c, `/api/erp/users?userId=${childId}`, "DELETE");
    check(tag, "archives its own user (soft, identity kept)", del.status === 200, del.status);
  }

  // branches: own domain only
  const tmpl = await call(c, `/api/branch-management/city-branches?id=${isBiz ? fx.QUETTA : CHAMAN_SHIP}`);
  const grants = tmpl.body?.cityBranches?.[0]?.permissionGrants ?? tmpl.body?.cityBranches?.[0]?.permission_grants ;
  const usableGrants = Array.isArray(grants) && grants.length ? grants : ["dashboard.access"];
  const listAll = await call(c, "/api/branch-management/city-branches");
  const listed = (listAll.body?.cityBranches ?? []).map((b) => b.id);
  check(tag, "branch list shows only its own domain's branches", listed.length > 0 && !(isBiz ? SHIP_CITIES : BIZ_CITIES).some((id) => listed.includes(id)), listed.length);
  const branchBody = (domain) => ({ countryId: fx.PK, countryBranchId: fx.PK_MAIN, operationalDomain: domain, cityName: "RBAC Test City", name: `RBAC-TEST ${tag} ${domain} branch ${Date.now().toString().slice(-6)}`, code: `RBT-${tag.slice(0, 3).toUpperCase()}-${domain.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-5)}`, currencyCode: "PKR", email: `rbac.branch.${Date.now()}@rbac-test.dev`, permissionGrants: usableGrants });
  const wrong = await call(c, "/api/branch-management/city-branches", "POST", branchBody(isBiz ? "shipping" : "business"));
  check(tag, "refused: create a branch of the other domain", wrong.status === 403, { status: wrong.status, err: wrong.body?.error });
  const editOtherBranch = await call(c, "/api/branch-management/city-branches", "PUT", { ...branchBody(p.domain), id: isBiz ? CHAMAN_SHIP : fx.QUETTA });
  check(tag, "refused: edit a branch of the other domain", editOtherBranch.status === 403, { status: editOtherBranch.status, err: editOtherBranch.body?.error });
  const ok = await call(c, "/api/branch-management/city-branches", "POST", branchBody(p.domain));
  const newBranchId = ok.body?.cityBranch?.id ?? ok.body?.data?.id ?? ok.body?.id ?? null;
  check(tag, `creates a ${p.domain} branch (201/200)`, (ok.status === 201 || ok.status === 200) && Boolean(newBranchId), { status: ok.status, id: newBranchId, err: ok.body?.error });
  if (newBranchId) {
    const rm = await call(SA, `/api/branch-management/city-branches?id=${newBranchId}`, "DELETE");
    check("cleanup", `Global SA removes the test branch (${tag})`, rm.status === 200, rm.status);
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\nRESULT ${passed}/${results.length} passed`);
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ passed, total: results.length, results }, null, 2));
process.exit(passed === results.length ? 0 : 1);
