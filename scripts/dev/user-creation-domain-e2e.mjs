/**
 * DEV-only: Task A user-creation matrix — Business users only in Business branches, Shipping users only in Shipping branches,
 * Country Admins only inside their own country / domain, one identity = one user.
 *   BASE=http://127.0.0.1:3540 node scripts/dev/user-creation-domain-e2e.mjs
 * Creates "[E2E TEST]" users in the DEV database only (BASE must be localhost; the dev server points at the DEV project).
 */
import { IDS, tally, rows } from "./_rbac-lib.mjs";
import { ensureTestUser, globalClient, loginAsUser, lookupUserId, randomPassword } from "./_rbac-users.mjs";

const T = tally();
const g = await globalClient();

// 1) the admins under test (created by the Global Super Admin through the real API)
const biz = await ensureTestUser(g, { key: "e2e.biz.super", name: "Business Super Admin", role: "super_admin", domain: "business" });
const shp = await ensureTestUser(g, { key: "e2e.ship.super", name: "Shipping Super Admin", role: "super_admin", domain: "shipping" });
// Pakistan already has its one active Shipping Country Admin (a duplicate-admin guard protects the scope), so the existing DEV user
// is acted as through dev-session { userId } - its REAL assignment is re-read from the DEV database, no password involved.
const pkShipAdminId = await lookupUserId("pakistan.shipping.admin@dgt.llc");
const pkShipAdmin = { id: pkShipAdminId, created: false };
T.check("setup: Business Super Admin identity exists", !!biz.id, biz.created ? "created" : "reused");
T.check("setup: Shipping Super Admin identity exists", !!shp.id, shp.created ? "created" : "reused");
T.check("setup: Pakistan Shipping Country Admin (existing DEV user) found", !!pkShipAdmin.id, "existing");

const expect = (name, res, ...codes) =>
  T.check(name, codes.includes(res.status), `HTTP ${res.status} ${res.json?.error?.code ?? res.json?.error?.message ?? ""}`.slice(0, 170));
const mk = (c, key, role, domain, loc, extra = {}) =>
  c.req("POST", "/api/erp/users", {
    fullName: `[E2E TEST] ${key}`, email: `${key}@e2e-test.dev`, password: randomPassword(),
    preferredLanguage: "en", role, operationalDomain: domain, ...loc, ...extra,
  });
const PK_QUETTA = { countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA };
const PK_CHAMAN = { countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.CHAMAN_SHIP };
const UAE_ALRAS = { countryId: IDS.UAE, countryBranchId: IDS.UAE_MAIN, cityBranchId: IDS.ALRAS_SHIP };

// 2) Global Super Admin: branch <-> domain consistency applies to EVERY creator
expect("Global SA: Shipping user on a BUSINESS branch (Quetta) is refused", await mk(g, "e2e.neg.ship-on-quetta", "city_branch_admin", "shipping", PK_QUETTA), 422);
expect("Global SA: Business user on a SHIPPING branch (Chaman) is refused", await mk(g, "e2e.neg.biz-on-chaman", "city_branch_admin", "business", PK_CHAMAN), 422);
const chaman = await ensureTestUser(g, { key: "e2e.chaman.staff", name: "Chaman Shipping Staff", role: "staff_user", domain: "shipping", ...PK_CHAMAN, ledgerVisibility: "scoped" });
T.check("Global SA: Shipping user on the Shipping branch (Chaman) is accepted", !!chaman.id, chaman.created ? "created" : "reused/" + JSON.stringify(chaman.res?.json?.error ?? "").slice(0, 120));
const quetta = await ensureTestUser(g, { key: "e2e.quetta.accountant", name: "Quetta Business Accountant", role: "accountant", domain: "business", ...PK_QUETTA });
T.check("Global SA: Business user on the Business branch (Quetta) is accepted", !!quetta.id, quetta.created ? "created" : "reused/" + JSON.stringify(quetta.res?.json?.error ?? "").slice(0, 120));

// 3) one identity = one user
expect("duplicate e-mail is refused (no second identity)", await mk(g, "e2e.quetta.accountant", "accountant", "business", PK_QUETTA), 409, 400, 422);

// 4) Business Super Admin (acting as the real DB-backed test identity)
if (biz.id) {
  const b = await loginAsUser(biz.id);
  const sess = (await b.get("/api/erp/auth/session")).json?.data;
  T.check("Business Super Admin resolves to the domain role, not Global Super Admin", sess?.roles?.includes("business_super_admin") && !sess?.scopes?.isSuperAdmin, JSON.stringify(sess?.roles));
  expect("Business SA: creates a Business user at Quetta", await mk(b, "e2e.bsa.quetta.staff", "cashier", "business", PK_QUETTA), 200, 201, 409);
  expect("Business SA: cannot create a Shipping-domain user", await mk(b, "e2e.bsa.neg.ship", "cashier", "shipping", PK_CHAMAN), 403);
  expect("Business SA: cannot place a Business user on the Shipping branch", await mk(b, "e2e.bsa.neg.chaman", "cashier", "business", PK_CHAMAN), 403, 422);
  expect("Business SA: cannot create a Global Super Admin", await mk(b, "e2e.bsa.neg.super", "super_admin", "both", {}), 403);
  const list = rows((await b.get("/api/erp/users/journal-report?limit=1000")).json, "rows");
  T.check("Business SA user directory: Business users only", list.length > 0 && list.every((u) => u.operationalDomain === "business"), `${list.length} rows, domains=${[...new Set(list.map((u) => u.operationalDomain))]}`);
  const brs = rows((await b.get("/api/erp/locations/branches/city?scope=all")).json, "cityBranches");
  T.check("Business SA branch list: Business branches only", brs.length > 0 && brs.every((x) => x.operationalDomain !== "shipping"), `${brs.map((x) => x.name)}`);
}

// 5) Shipping Super Admin
if (shp.id) {
  const s = await loginAsUser(shp.id);
  const sess = (await s.get("/api/erp/auth/session")).json?.data;
  T.check("Shipping Super Admin resolves to the domain role, not Global Super Admin", sess?.roles?.includes("shipping_super_admin") && !sess?.scopes?.isSuperAdmin, JSON.stringify(sess?.roles));
  expect("Shipping SA: creates a Shipping user at Chaman", await mk(s, "e2e.ssa.chaman.staff", "staff_user", "shipping", PK_CHAMAN), 200, 201, 409);
  expect("Shipping SA: cannot create a Business-domain user", await mk(s, "e2e.ssa.neg.biz", "cashier", "business", PK_QUETTA), 403);
  expect("Shipping SA: cannot place a Shipping user on a Business branch", await mk(s, "e2e.ssa.neg.quetta", "staff_user", "shipping", PK_QUETTA), 403, 422);
  const list = rows((await s.get("/api/erp/users/journal-report?limit=1000")).json, "rows");
  T.check("Shipping SA user directory: Shipping users only", list.length > 0 && list.every((u) => u.operationalDomain === "shipping"), `${list.length} rows, domains=${[...new Set(list.map((u) => u.operationalDomain))]}`);
}

// 6) Country Admin (Pakistan, shipping) - only its own country and domain
if (pkShipAdmin.id) {
  const c = await loginAsUser(pkShipAdmin.id);
  expect("PK Shipping Country Admin: creates a Shipping user in its country (Chaman)", await mk(c, "e2e.pkc.chaman.staff", "staff_user", "shipping", PK_CHAMAN), 200, 201, 409);
  expect("PK Shipping Country Admin: UAE (another country) is refused", await mk(c, "e2e.pkc.neg.uae", "staff_user", "shipping", UAE_ALRAS), 403, 400, 500);
  expect("PK Shipping Country Admin: Business-domain user is refused", await mk(c, "e2e.pkc.neg.biz", "cashier", "business", PK_QUETTA), 403);
  expect("PK Shipping Country Admin: Shipping user on a Business branch is refused", await mk(c, "e2e.pkc.neg.quetta", "staff_user", "shipping", PK_QUETTA), 403, 422);
  expect("PK Shipping Country Admin: cannot create another Country Admin", await mk(c, "e2e.pkc.neg.country", "country_admin", "shipping", { countryId: IDS.PK }), 403);
}
process.exit(T.summary() ? 0 : 1);
