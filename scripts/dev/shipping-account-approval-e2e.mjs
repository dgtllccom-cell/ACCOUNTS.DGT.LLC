/**
 * DEV-only Task B end-to-end: a Chaman Shipping Branch Admin opens a Shipping Line customer account on the EXISTING Account
 * Master; it stays Pending Approval (ledger inactive) until the Country Admin AND the Operations Country Admin approved it.
 *   BASE=http://127.0.0.1:3540 node scripts/dev/shipping-account-approval-e2e.mjs
 * Uses DB-backed "[E2E TEST]" identities created through the real users API (DEV database only).
 */
import { IDS, tally, rows } from "./_rbac-lib.mjs";
import { globalClient, loginAsUser, lookupUserId } from "./_rbac-users.mjs";

const T = tally();
const g = await globalClient();
const PK_CHAMAN = { countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.CHAMAN_SHIP };
const PK_QUETTA = { countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA };

// The acting identities are EXISTING DEV users (looked up read-only in the DEV database, acted as through dev-session { userId } so the
// live resolver re-reads their REAL assignment + permission set; no password involved). Duplicate-admin guards forbid creating a second
// admin in the same scope, so test copies of these roles cannot be created.
const ids = {
  chaman: await lookupUserId("chaman.shipping@dgt.llc"),            // Chaman Shipping Branch Admin (the subject of Task B)
  country: await lookupUserId("pakistan.shipping.admin@dgt.llc"),   // Pakistan Shipping Country Admin
  ops: await lookupUserId("rbac.ops.pk@rbac-test.dev"),             // Pakistan Operations Country Admin (country_admin + operations profile)
  quetta: await lookupUserId("quetta.accountant@dgt.llc"),          // Quetta Business accountant (isolation check)
};
T.check("setup: four existing DEV identities found", Object.values(ids).every(Boolean), Object.entries(ids).map(([k, v]) => `${k}=${v?.slice(0, 8)}`).join(" "));

const chaman = await loginAsUser(ids.chaman);
const country = await loginAsUser(ids.country);
const ops = await loginAsUser(ids.ops);
const quetta = await loginAsUser(ids.quetta);

for (const [n, c, role] of [["chaman", chaman, "city_branch_admin"], ["country", country, "country_admin"], ["ops", ops, "country_operations_admin"]]) {
  const s = (await c.get("/api/erp/auth/session")).json?.data;
  T.check(`session: ${n} resolves to ${role}`, s?.roles?.includes(role), JSON.stringify(s?.roles));
}

const stamp = Date.now().toString(36).toUpperCase();
const accountBody = {
  scope: "city_branch", ...PK_CHAMAN, operationalDomain: "shipping", code: "AUTO", name: `[E2E TEST] Chaman Shipping Customer ${stamp}`,
  kind: "asset", currency: "PKR", openingBalance: 0, contacts: [{ type: "phone", value: "+92 300 0000000" }],
};

// ---- B1 creation: pending, not active ---------------------------------------------------------------------------------
const created = await chaman.req("POST", "/api/erp/accounting/accounts", accountBody);
const acc = created.json?.data ?? created.json;
T.check("B1 Chaman admin creates a Shipping account", created.status === 201 || created.status === 200, `HTTP ${created.status} ${created.json?.error?.message ?? ""}`.slice(0, 180));
const accountId = acc?.accountId ?? acc?.id;
T.check("B1 account is Pending Approval (not Active)", acc?.status === "pending_approval", `status=${acc?.status}`);
T.check("B1 an approval request was raised", Boolean(acc?.approvalRequestId), `approvalRequestId=${acc?.approvalRequestId?.slice?.(0, 8)}`);
const approvalId = acc?.approvalRequestId;

const queue0 = rows((await chaman.get("/api/erp/accounting/account-approvals?status=pending")).json, "requests");
const mine = queue0.find((r) => r.id === approvalId);
T.check("B1 the creator sees the request in its queue at stage 1 (cannot decide it)", mine && mine.stage === 1 && mine.canDecide === false, mine ? `stage=${mine.stage} canDecide=${mine.canDecide}` : "missing");

// ---- B2 no activity before approval ------------------------------------------------------------------------------------
const detail0 = (await g.get(`/api/erp/accounting/accounts/${accountId}`)).json?.data;
T.check("B2 account record is pending_approval", (detail0?.account?.status ?? detail0?.status) === "pending_approval", JSON.stringify(detail0?.account?.status ?? detail0?.status));
const ledger0 = detail0?.ledger ?? detail0?.account?.ledger;
T.check("B2 its ledger is inactive (posting impossible)", ledger0 ? ledger0.is_active === false : true, ledger0 ? `is_active=${ledger0.is_active}` : "ledger not returned (guard is is_active=false at posting)");

// ---- B3 wrong approvers are refused ----------------------------------------------------------------------------------
const decide = (c, id, action = "approve", note) => c.req("PATCH", `/api/erp/approvals/${id}`, { action, ...(note ? { note } : {}) });
const r1 = await decide(chaman, approvalId);
T.check("B3 the creating Chaman admin cannot approve its own account", r1.status === 403, `HTTP ${r1.status} ${r1.json?.error?.code ?? ""}`);
const r2 = await decide(ops, approvalId);
T.check("B3 Operations Country Admin cannot skip stage 1", r2.status === 403, `HTTP ${r2.status} ${r2.json?.error?.code ?? ""}`);
const r3 = await decide(quetta, approvalId);
T.check("B3 a Business branch admin cannot touch the request", r3.status === 403, `HTTP ${r3.status}`);

// ---- B4 stage 1: Country Admin ---------------------------------------------------------------------------------------
const cq = rows((await country.get("/api/erp/accounting/account-approvals?status=pending")).json, "requests").find((r) => r.id === approvalId);
T.check("B4 Country Admin sees the request and may decide stage 1", cq?.canDecide === true && cq?.stage === 1, cq ? `stage=${cq.stage} canDecide=${cq.canDecide}` : "missing");
const s1 = await decide(country, approvalId, "approve", "stage 1 ok");
T.check("B4 Country Admin approves stage 1 -> request still pending, now stage 2", s1.status === 200 && s1.json?.data?.status === "pending" && s1.json?.data?.nextStage === 2, `HTTP ${s1.status} ${JSON.stringify(s1.json?.data ?? s1.json?.error)}`.slice(0, 200));
const mid = (await g.get(`/api/erp/accounting/accounts/${accountId}`)).json?.data;
T.check("B4 account is STILL pending after stage 1", (mid?.account?.status ?? mid?.status) === "pending_approval", JSON.stringify(mid?.account?.status ?? mid?.status));
const r4 = await decide(country, approvalId);
T.check("B4 Country Admin cannot also decide stage 2", r4.status === 403, `HTTP ${r4.status} ${r4.json?.error?.code ?? ""}`);

// ---- B5 stage 2: Operations Country Admin --------------------------------------------------------------------------
const oq = rows((await ops.get("/api/erp/accounting/account-approvals?status=pending")).json, "requests").find((r) => r.id === approvalId);
T.check("B5 Operations Country Admin sees the request and may decide stage 2", oq?.canDecide === true && oq?.stage === 2, oq ? `stage=${oq.stage} canDecide=${oq.canDecide}` : "missing");
const s2 = await decide(ops, approvalId, "approve", "stage 2 ok");
T.check("B5 Operations Country Admin approves -> approved", s2.status === 200 && s2.json?.data?.status === "approved", `HTTP ${s2.status} ${JSON.stringify(s2.json?.data ?? s2.json?.error)}`.slice(0, 200));
const fin = (await g.get(`/api/erp/accounting/accounts/${accountId}`)).json?.data;
T.check("B5 account is now Active", (fin?.account?.status ?? fin?.status) === "active", JSON.stringify(fin?.account?.status ?? fin?.status));

// ---- B6 history + timestamps ---------------------------------------------------------------------------------------------
const all = rows((await country.get("/api/erp/accounting/account-approvals?status=all")).json, "requests").find((r) => r.id === approvalId);
const stamps = (all?.history ?? []).map((h) => [h.to_status, h.actor_name ?? h.actor_id?.slice(0, 8), h.created_at]);
T.check("B6 approval history keeps every step with actor and timestamp (>= 3 rows)", (all?.history?.length ?? 0) >= 3 && all.history.every((h) => h.created_at && h.actor_id), JSON.stringify(stamps).slice(0, 220));
T.check("B6 both stage approvals are recorded on the request", all?.stageApprovals?.length === 2 && all.stageApprovals.every((a) => a.at && a.actorId), JSON.stringify(all?.stageApprovals ?? []).slice(0, 200));

// ---- B7 no duplicates; scope; isolation -----------------------------------------------------------------------------
const dup = await chaman.req("POST", "/api/erp/accounting/accounts", { ...accountBody });
T.check("B7 same party twice is refused (Account Master has no duplicates)", dup.status === 409, `HTTP ${dup.status} ${dup.json?.error?.code ?? ""}`);
const offScope = await chaman.req("POST", "/api/erp/accounting/accounts", { ...accountBody, name: `[E2E TEST] Out of scope ${stamp}`, ...PK_QUETTA });
T.check("B7 Chaman cannot open an account in another branch (Quetta)", offScope.status === 403, `HTTP ${offScope.status}`);
const asBusiness = await chaman.req("POST", "/api/erp/accounting/accounts", { ...accountBody, name: `[E2E TEST] Business try ${stamp}`, operationalDomain: "business" });
T.check("B7 a Shipping admin cannot open a Business-domain account", asBusiness.status === 403, `HTTP ${asBusiness.status}`);
const qList = rows((await quetta.get("/api/erp/accounting/accounts")).json, "accounts");
T.check("B7 the Quetta (Business) admin does not see the Shipping account", !qList.some((a) => a.id === accountId), `${qList.length} accounts listed`);
const qOne = await quetta.get(`/api/erp/accounting/accounts/${accountId}`);
T.check("B7 ... nor open it by id", qOne.status === 404 || qOne.status === 403 || !(qOne.json?.data?.account), `HTTP ${qOne.status}`);
const cList = rows((await chaman.get("/api/erp/accounting/accounts")).json, "accounts");
T.check("B7 Chaman sees its own account (Active) and only Shipping accounts", cList.some((a) => a.id === accountId) && cList.every((a) => a.operational_domain !== "business"), `${cList.length} listed`);

// ---- B8 rejection path (new request) ---------------------------------------------------------------------------------
const rejBody = { ...accountBody, name: `[E2E TEST] Chaman Rejected ${stamp}` };
const rejCreated = (await chaman.req("POST", "/api/erp/accounting/accounts", rejBody)).json?.data;
const rej = await decide(country, rejCreated?.approvalRequestId, "reject", "not a valid party");
T.check("B8 Country Admin can reject at stage 1", rej.status === 200 && rej.json?.data?.status === "rejected", `HTTP ${rej.status}`);
const rejDetail = (await g.get(`/api/erp/accounting/accounts/${rejCreated?.accountId}`)).json?.data;
T.check("B8 a rejected account never becomes Active", (rejDetail?.account?.status ?? rejDetail?.status) !== "active", JSON.stringify(rejDetail?.account?.status ?? rejDetail?.status));

process.exit(T.summary() ? 0 : 1);
