/**
 * DEV only — scope + permission verification of the Branch Admin (Chaman Shipping) and the Country Admin (UAE) on the pages and
 * APIs that arrived with production 658c4be / a86355d, plus the user-management rules of a City Branch Admin.
 *   BASE=http://localhost:3521 node scripts/dev/branch-admin-permissions-e2e.mjs
 * Pages: a branch / country login never reaches another branch or country through ?branchId= / ?countryId=, never falls back to
 * "the first branch of the database", and a branch login never opens the country dashboard.
 * APIs: a City Branch Admin manages the STAFF of its own branch only (never a peer admin, never another branch), cannot create
 * admin roles or users in another branch / with a foreign main-branch id, and loses user management when its permission set
 * no longer carries users:update.
 */
import { IDS, PERSONAS, login, client, tally } from "./_rbac-lib.mjs";
import { devQuery, ensureTestUser, globalClient, loginAsUser, lookupUserId, randomPassword } from "./_rbac-users.mjs";

const T = tally();
const GWADAR = "01b4a42f-2791-47bd-aa9a-31d28f9d6d9b";
const GWADAR_MAIN = "a76796a0-79ae-4f1a-a314-58838f73af9b";
const PK_CHAMAN = { countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.CHAMAN_SHIP };
const PK_GWADAR = { countryId: IDS.PK, countryBranchId: GWADAR_MAIN, cityBranchId: GWADAR };

const as = async (body) => client(await login(body));
const status = (r) => `HTTP ${r.status}${r.location ? " → " + r.location.replace(/^https?:\/\/[^/]+/, "") : ""}`;
const redirectsAway = (r) => [301, 302, 303, 307, 308].includes(r.status) && !/\/dashboard\/(branch-management|reports\/branch-reports|country\/shipping-line)/.test(r.location || "");
const opens = (r) => r.status === 200;

// ───────── pages ─────────
const chaman = await as(PERSONAS.chaman_ship.body);
const uaeCountry = await as({ role: "country_admin", countryId: IDS.UAE, operationalDomain: "shipping" });
const pkCountry = await as({ role: "country_admin", countryId: IDS.PK, operationalDomain: "shipping" });
const accountantNoBranch = await as({ role: "accountant", countryId: IDS.PK, operationalDomain: "business" });

let r = await chaman.get("/dashboard/branch-management/permissions");
T.check("Chaman Branch Admin: permission management opens for its own branch", opens(r), status(r));
r = await chaman.get(`/dashboard/branch-management/permissions?branchId=${IDS.ALRAS_SHIP}`);
T.check("Chaman Branch Admin: permission management of ANOTHER COUNTRY's branch (?branchId=) is refused", redirectsAway(r), status(r));
r = await chaman.get(`/dashboard/branch-management/permissions?branchId=${GWADAR}`);
T.check("Chaman Branch Admin: permission management of ANOTHER PK branch (?branchId=) is refused", redirectsAway(r), status(r));
r = await chaman.get("/dashboard/reports/branch-reports");
T.check("Chaman Branch Admin: branch reports open for its own branch", opens(r), status(r));
r = await chaman.get(`/dashboard/reports/branch-reports?branchId=${IDS.ALRAS_SHIP}`);
T.check("Chaman Branch Admin: branch reports of another country's branch are refused", redirectsAway(r), status(r));
r = await chaman.get("/dashboard/country/shipping-line");
T.check("Chaman Branch Admin: the COUNTRY shipping dashboard is not opened by a branch login", !opens(r), status(r));
r = await chaman.get(`/dashboard/country/shipping-line?countryId=${IDS.UAE}`);
T.check("Chaman Branch Admin: ?countryId= of another country does not open it either", !opens(r), status(r));

r = await uaeCountry.get("/dashboard/country/shipping-line");
T.check("UAE Country Admin: the UAE country shipping dashboard opens", opens(r), status(r));
r = await uaeCountry.get(`/dashboard/country/shipping-line?countryId=${IDS.PK}`);
T.check("UAE Country Admin: ?countryId=<Pakistan> is refused (no cross-country view)", redirectsAway(r), status(r));
r = await uaeCountry.get(`/dashboard/branch-management/permissions?branchId=${IDS.ALRAS_SHIP}`);
T.check("UAE Country Admin: permission management of a UAE branch opens", opens(r), status(r));
r = await uaeCountry.get(`/dashboard/branch-management/permissions?branchId=${IDS.CHAMAN_SHIP}`);
T.check("UAE Country Admin: permission management of a PAKISTAN branch is refused", redirectsAway(r), status(r));
r = await uaeCountry.get(`/dashboard/reports/branch-reports?branchId=${IDS.CHAMAN_SHIP}`);
T.check("UAE Country Admin: branch reports of a PAKISTAN branch are refused", redirectsAway(r), status(r));
r = await uaeCountry.get(`/dashboard/reports/branch-reports?branchId=${IDS.ALRAS_SHIP}`);
T.check("UAE Country Admin: branch reports of a UAE branch open", opens(r), status(r));
r = await pkCountry.get("/dashboard/country/shipping-line");
T.check("Pakistan Country Admin: the Pakistan country shipping dashboard opens", opens(r), status(r));

// a login bound to ONE domain never opens a branch of the other domain (Deira = UAE Business branch, Al Ras = UAE Shipping branch)
r = await uaeCountry.get(`/dashboard/branch-management/permissions?branchId=${IDS.DEIRA}`);
T.check("UAE Shipping-domain Country Admin: a Business-domain branch's permission screen is refused", redirectsAway(r), status(r));
r = await uaeCountry.get(`/dashboard/reports/branch-reports?branchId=${IDS.DEIRA}`);
T.check("UAE Shipping-domain Country Admin: a Business-domain branch's reports are refused", redirectsAway(r), status(r));
r = await accountantNoBranch.get(`/dashboard/reports/branch-reports?branchId=${IDS.CHAMAN_SHIP}`);
T.check("Business-domain accountant: a Shipping branch's reports are refused (?branchId= of the other domain)", redirectsAway(r), status(r));

// ───────── user management (APIs) ─────────
const g = await globalClient();
const staff = await ensureTestUser(g, { key: "e2e.chaman.staff", name: "Chaman Shipping Staff", role: "staff_user", domain: "shipping", ...PK_CHAMAN, ledgerVisibility: "scoped" });
const gwadarStaff = await ensureTestUser(g, { key: "e2e.gwadar.staff", name: "Gwadar Shipping Staff", role: "staff_user", domain: "shipping", ...PK_GWADAR, ledgerVisibility: "scoped" });
const realChamanAdmin = await lookupUserId("chaman.shipping@dgt.llc");
T.check("setup: Chaman staff, Gwadar staff and the existing Chaman Branch Admin exist", !!(staff.id && gwadarStaff.id && realChamanAdmin), `${staff.id ? "" : "no chaman staff "}${gwadarStaff.id ? "" : "no gwadar staff "}${realChamanAdmin ? "" : "no chaman admin"}`);

if (staff.id && gwadarStaff.id) {
  r = await chaman.req("PATCH", "/api/erp/users", { userId: staff.id, isActive: true });
  T.check("Branch Admin: edits the STAFF of its own branch", r.status === 200, status(r));
  r = await chaman.req("PATCH", "/api/erp/users", { userId: gwadarStaff.id, isActive: true });
  T.check("Branch Admin: cannot edit the staff of ANOTHER branch", r.status === 403, status(r));
  if (realChamanAdmin) {
    r = await chaman.req("PATCH", "/api/erp/users", { userId: realChamanAdmin, isActive: true });
    T.check("Branch Admin: cannot edit a PEER branch admin of the same branch", r.status === 403, status(r));
    r = await chaman.req("POST", "/api/erp/users/password", { userId: realChamanAdmin, generateTemporary: true });
    T.check("Branch Admin: cannot reset the password of a peer admin", r.status === 403, status(r));
  }
  r = await chaman.req("POST", "/api/erp/users/password", { userId: gwadarStaff.id, generateTemporary: true });
  T.check("Branch Admin: cannot reset the password of another branch's staff", r.status === 403, status(r));
  r = await chaman.req("PATCH", "/api/erp/users", { userId: staff.id, role: "city_branch_admin" });
  T.check("Branch Admin: cannot promote its staff to Branch Admin", r.status === 403, status(r));
  r = await chaman.req("PATCH", "/api/erp/users", { userId: staff.id, permissions: ["*:*", "purchases:*", "payroll:read"] });
  const stored = (await devQuery((sql) => sql`select permissions from public.user_permission_sets where user_id = ${staff.id}::uuid and deleted_at is null`))[0]?.permissions ?? [];
  T.check("Branch Admin: a wildcard / tokens it does not hold itself are never stored", r.status >= 400 || !stored.some((p) => ["*:*", "purchases:*", "payroll:read"].includes(p)), `${status(r)} stored=${stored.length} tokens`);
  // restore the shared test user's rights (the line above may have emptied them) so later runs start from the role template
  await g.req("PATCH", "/api/erp/users", { userId: staff.id, role: "staff_user" });
}

const mk = (c, key, role, loc, extra = {}) => c.req("POST", "/api/erp/users", { fullName: `[E2E TEST] ${key}`, email: `${key}@e2e-test.dev`, password: randomPassword(), preferredLanguage: "en", role, operationalDomain: "shipping", ...loc, ...extra });
r = await mk(chaman, "e2e.neg.admin", "city_branch_admin", PK_CHAMAN);
T.check("Branch Admin: cannot create another Branch Admin", r.status === 403, status(r));
r = await mk(chaman, "e2e.neg.main", "main_branch_admin", PK_CHAMAN);
T.check("Branch Admin: cannot create a Main Branch Admin", r.status === 403, status(r));
r = await mk(chaman, "e2e.neg.gwadar", "staff_user", PK_GWADAR);
T.check("Branch Admin: cannot create a user in another branch", r.status === 403, status(r));
r = await mk(chaman, "e2e.neg.foreign-main", "staff_user", { ...PK_CHAMAN, countryBranchId: GWADAR_MAIN });
T.check("Branch Admin: a foreign main-branch id on a create is refused", r.status === 403, status(r));
r = await mk(chaman, "e2e.neg.uae", "staff_user", { countryId: IDS.UAE, countryBranchId: IDS.UAE_MAIN, cityBranchId: IDS.ALRAS_SHIP });
T.check("Branch Admin: cannot create a user in another country", r.status === 403, status(r));
r = await mk(chaman, "e2e.neg.business", "staff_user", PK_CHAMAN, { operationalDomain: "business" });
T.check("Branch Admin (Shipping): cannot create a Business-domain user", r.status === 403 || r.status === 422, status(r));

// a city admin whose permission set no longer carries users:update / users:create loses user management (explicit grant is respected)
const gAdmin = await ensureTestUser(g, { key: "e2e.gwadar.admin", name: "Gwadar Shipping Branch Admin", role: "city_branch_admin", domain: "shipping", ...PK_GWADAR, ledgerVisibility: "scoped" });
if (gAdmin.id && gwadarStaff.id) {
  // start every run from the role template (a previous run strips users:update / users:create from this shared test admin)
  await g.req("PATCH", "/api/erp/users", { userId: gAdmin.id, role: "city_branch_admin" });
  const sess = await loginAsUser(gAdmin.id);
  const before = await sess.req("PATCH", "/api/erp/users", { userId: gwadarStaff.id, isActive: true });
  T.check("DB-backed Branch Admin with the role template: manages its branch staff", before.status === 200, status(before));
  const made = await mk(sess, "e2e.gwadar.staff2", "staff_user", PK_GWADAR);
  // DEV's Gwadar branch carries a Business-only permission ceiling (like Chaman in Production), so the refusal must be the explained 422, never a 500
  T.check("DB-backed Branch Admin: staff creation inside its own branch succeeds, or is refused with the explained ceiling message (never a 500)", [200, 201, 409].includes(made.status) || (made.status === 422 && made.json?.error?.code === "NO_ASSIGNABLE_PERMISSIONS"), status(made) + " " + (made.json?.error?.code ?? ""));
  const cur = (await g.get(`/api/erp/users?userId=${gAdmin.id}`)).json;
  const perms = (cur?.data?.permissions ?? cur?.permissions ?? []).filter((p) => p !== "users:update" && p !== "users:create" && p !== "users:*");
  const strip = await g.req("PATCH", "/api/erp/users", { userId: gAdmin.id, permissions: perms });
  T.check("setup: the admin's permission set is saved without users:update / users:create", strip.status === 200 && perms.length > 0, status(strip) + ` (${perms.length} tokens)`);
  const sess2 = await loginAsUser(gAdmin.id);
  const after = await sess2.req("PATCH", "/api/erp/users", { userId: gwadarStaff.id, isActive: true });
  T.check("…then it can no longer manage users (the owner can withhold the right per user)", after.status === 403, status(after));
  const create = await mk(sess2, "e2e.gwadar.staff3", "staff_user", PK_GWADAR);
  T.check("…nor create users", create.status === 403, status(create));
}

process.exit(T.summary() ? 0 : 1);
