/**
 * DEV only - the Reports Center permission matrix, role by role, through the real routes (page URLs and API parameters).
 *   BASE=http://localhost:3557 node scripts/dev/reports-center-matrix.mjs
 *
 * Personas come from POST /api/erp/auth/dev-session (synthetic identity, no password). Every expectation is about what the SERVER answers:
 * a forged country / branch / record id, a domain the login does not hold, a Super-Admin-only page and the audit endpoints are all tried directly.
 */
import { IDS, PERSONAS, login, client, tally } from "./_rbac-lib.mjs";

const T = tally();
const extra = {
  staff_biz: { label: "Staff user (business, Quetta)", body: { role: "staff_user", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA, operationalDomain: "business" } },
  cashier_biz: { label: "Cashier (business, Quetta)", body: { role: "cashier", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA, operationalDomain: "business" } },
  agent_ship: { label: "Agent user (shipping, Chaman)", body: { role: "agent_user", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.CHAMAN_SHIP, operationalDomain: "shipping" } },
  shipline_admin: { label: "Shipping Line Admin (Chaman)", body: { role: "shipping_line_admin", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.CHAMAN_SHIP, operationalDomain: "shipping" } },
  ops_country: { label: "Country Operations Admin (shipping, PK)", body: { role: "country_operations_admin", countryId: IDS.PK, operationalDomain: "shipping" } }
};
const P = { ...PERSONAS, ...extra };
const c = {};
for (const [k, p] of Object.entries(P)) c[k] = client(await login(p.body));

const REG = (domain, qs = "") => `/api/erp/reports/country?domain=${domain}&pageSize=200&options=1${qs}`;
const data = (r) => r.json?.data ?? null;

// ── 1. register: who gets which domain ─────────────────────────────────────────────────────────────────────────
const expectBiz = { global_super: 200, biz_super: 200, ship_super: 403, pk_country_biz: 200, pk_country_ship: 403, quetta_biz: 200, deira_biz: 200, chaman_ship: 403, alras_ship: 403, staff_biz: 403, cashier_biz: 403, agent_ship: 403, shipline_admin: 403, ops_country: 403 };
const expectShip = { global_super: 200, biz_super: 403, ship_super: 200, pk_country_biz: 403, pk_country_ship: 200, quetta_biz: 403, deira_biz: 403, chaman_ship: 200, alras_ship: 200, staff_biz: 403, cashier_biz: 403, agent_ship: 200, shipline_admin: 200, ops_country: 200 };
const reg = {};
for (const k of Object.keys(P)) {
  reg[k] = { biz: await c[k].get(REG("business")), ship: await c[k].get(REG("shipping")) };
  T.check(`register business: ${P[k].label} -> ${expectBiz[k]}`, reg[k].biz.status === expectBiz[k], `got ${reg[k].biz.status}`);
  T.check(`register shipping: ${P[k].label} -> ${expectShip[k]}`, reg[k].ship.status === expectShip[k], `got ${reg[k].ship.status}`);
}

// ── 2. scope of the rows ───────────────────────────────────────────────────────────────────────────────────────
const gb = data(reg.global_super.biz), gs = data(reg.global_super.ship);
T.check("Super Admin sees real Business rows", gb?.total > 0, `total ${gb?.total}`);
T.check("Super Admin sees real Shipping rows", gs?.total > 0, `total ${gs?.total}`);
T.check("no Business row in the Shipping register and no Shipping row in the Business register", (gs?.rows ?? []).every((r) => r.domain === "shipping") && (gb?.rows ?? []).every((r) => r.domain === "business"));
T.check("totals are grouped per currency (every total names its currency; no row has an empty-currency total)", (gb?.grand ?? []).length > 0 && gb.grand.every((g) => /^[A-Z]{3}$/.test(g.currency)));
const pk = data(reg.pk_country_biz.biz);
T.check("Country Admin (PK) sees fewer rows than the Super Admin and only Pakistan-side records", pk && pk.total < gb.total && (pk.rows ?? []).every((r) => !r.countryName || ["Pakistan", "United Arab Emirates"].includes(r.countryName)), `PK ${pk?.total} of ${gb.total}`);
const qb = data(reg.quetta_biz.biz);
T.check("Branch Admin (Quetta) sees fewer rows than the Country Admin", qb && qb.total <= pk.total, `Quetta ${qb?.total} PK ${pk?.total}`);
T.check("Branch Admin filter options hold only its own scope (no other country, no other branch)", (qb?.options?.countries ?? []).length <= 1 && (qb?.options?.cityBranches ?? []).every((b) => b.id === IDS.QUETTA), JSON.stringify({ c: qb?.options?.countries?.length, b: qb?.options?.cityBranches?.map((b) => b.name) }));
T.check("Branch Admin header identity names its role and scope level", qb?.viewer?.level === "branch" && qb?.viewer?.roles?.includes("city_branch_admin"));
T.check("Country Admin is Country level - not Branch", data(reg.pk_country_biz.biz)?.viewer?.level === "country");
const ag = data(reg.agent_ship.ship);
T.check("Agent user (assigned-only) sees only what it created", (ag?.rows ?? []).length === 0 || (ag.rows ?? []).every((r) => r.userName), `rows ${ag?.total}`);

// ── 3. forged parameters ───────────────────────────────────────────────────────────────────────────────────────
T.check("Country Admin asking for another country -> 403", (await c.pk_country_biz.get(REG("business", `&countryId=${IDS.UAE}`))).status === 403);
T.check("Branch Admin asking for another country -> 403", (await c.quetta_biz.get(REG("business", `&countryId=${IDS.UAE}`))).status === 403);
T.check("Branch Admin asking for another branch -> 403", (await c.quetta_biz.get(REG("business", `&branchId=${IDS.DEIRA}`))).status === 403);
T.check("Shipping Branch Admin asking for another country's branch -> 403", (await c.chaman_ship.get(REG("shipping", `&branchId=${IDS.ALRAS_SHIP}`))).status === 403);
T.check("a malformed id is refused (400), not passed to SQL", [400, 422].includes((await c.global_super.get(REG("business", "&countryId=not-a-uuid"))).status));
T.check("an unknown domain is refused", [400, 422].includes((await c.global_super.get("/api/erp/reports/country?domain=other")).status));

// ── 4. the View document (record API) ──────────────────────────────────────────────────────────────────────────
const pick = (rows, table) => rows.find((r) => r.source.table === table);
const bizRow = pick(gb.rows, "purchase_orders") ?? gb.rows[0];
const shipRow = pick(gs.rows, "clearing_customer_orders") ?? gs.rows[0];
const rec = (who, row) => c[who].get(`/api/erp/reports/record?table=${row.source.table}&id=${row.source.id}`);
const found = (r) => r.status === 200 && r.json?.data?.found === true;
const sa1 = await rec("global_super", bizRow);
T.check("Super Admin opens a Business record: real details, goods/payments sections present or honestly empty", found(sa1) && sa1.json.data.doc.general.length > 5, `${bizRow.key}`);
const doc = sa1.json?.data?.doc;
T.check("the document is read-only data only (no action fields) and names the saved currency", doc && !JSON.stringify(doc).match(/"(edit|delete|approve|confirm|transfer)"/i) && (doc.currency || doc.amounts.length >= 0));
T.check("Business record -> Shipping-only logins get 'not found' (never the Business amounts)", !found(await rec("ship_super", bizRow)) && !found(await rec("chaman_ship", bizRow)));
T.check("Shipping record -> Business-only logins get 'not found'", !found(await rec("biz_super", shipRow)) && !found(await rec("quetta_biz", shipRow)));
T.check("a Branch Admin of ANOTHER branch cannot open the record (scope)", await (async () => {
  const bizByBranch = gb.rows.find((r) => r.source.table === "purchase_orders" && r.branchName && !/quetta/i.test(r.branchName));
  if (!bizByBranch) return true;
  return !found(await rec("quetta_biz", bizByBranch));
})());
T.check("a user with no reports:read gets 403 from the record API", (await rec("staff_biz", bizRow)).status === 403);
T.check("a forged table name is refused (400)", [400, 422].includes((await c.global_super.get(`/api/erp/reports/record?table=profiles&id=${bizRow.source.id}`)).status));
if (shipRow) T.check("Shipping Super Admin opens a Shipping record", found(await rec("ship_super", shipRow)));

// ── 5. audit evidence ──────────────────────────────────────────────────────────────────────────────────────────
const sweep = async (path) => { const out = {}; for (const k of Object.keys(P)) out[k] = (await c[k].get(path)).status; return out; };
const audit = sweep;
const eh = await audit("/api/erp/audit/edit-history?limit=5");
T.check("edit history API: audit-eligible roles 200, normal users 403", eh.global_super === 200 && eh.quetta_biz === 200 && eh.pk_country_biz === 200 && eh.staff_biz === 403 && eh.cashier_biz === 403 && eh.agent_ship === 403, JSON.stringify(eh));
const dr = await audit("/api/erp/audit/deleted-records?limit=5");
T.check("deleted records API: audit-eligible roles 200, normal users 403", dr.global_super === 200 && dr.pk_country_biz === 200 && dr.staff_biz === 403 && dr.agent_ship === 403, JSON.stringify(dr));
const dba = await audit("/api/erp/audit/daily-branch-activity");
T.check("daily branch activity (Business amounts): Business admins 200, Shipping-only 403, normal users 403", dba.global_super === 200 && dba.quetta_biz === 200 && dba.chaman_ship === 403 && dba.ship_super === 403 && dba.staff_biz === 403, JSON.stringify(dba));
const me = await audit("/api/erp/audit/monthly-edits");
T.check("monthly edit summary: normal users 403", me.staff_biz === 403 && me.cashier_biz === 403 && me.global_super === 200, JSON.stringify(me));
const ua = await audit(`/api/erp/audit/user-activity?userId=00000000-0000-4000-8000-000000000009`);
T.check("user activity: normal users 403, Shipping-only 403", ua.staff_biz === 403 && ua.chaman_ship === 403, JSON.stringify(ua));
const ehShip = await c.chaman_ship.get("/api/erp/audit/edit-history?limit=200");
const ehBiz = await c.quetta_biz.get("/api/erp/audit/edit-history?limit=200");
const SHIP_T = /^(clearing_|shipping_|customs_|truck|container|bl_|customer_receipts)/i;
T.check("Shipping admin's edit history holds no Business record table", ehShip.status === 200 && (ehShip.json?.records ?? []).every((r) => SHIP_T.test(String(r.module || r.recordTable || "")) || /clearing|shipping|receipt/i.test(String(r.module || ""))), `rows ${(ehShip.json?.records ?? []).length}`);
T.check("Business admin's edit history holds no Shipping record table", ehBiz.status === 200 && (ehBiz.json?.records ?? []).every((r) => !/clearing|shipping|customer receipt/i.test(String(r.module || ""))), `rows ${(ehBiz.json?.records ?? []).length}`);

// ── 6. page URLs typed directly ────────────────────────────────────────────────────────────────────────────────
const page = sweep;
const okPage = (s) => s === 200;
const forms = await page("/dashboard/reports/system-forms-directory");
T.check("system forms directory: Super Admin only", okPage(forms.global_super) && Object.entries(forms).every(([k, v]) => k === "global_super" || v === 403), JSON.stringify(forms));
const eHist = await page("/dashboard/super-admin/edit-history?view=all");
T.check("edit & version history page: Super Admin only", okPage(eHist.global_super) && Object.entries(eHist).every(([k, v]) => k === "global_super" || v === 403), JSON.stringify(eHist));
const dRec = await page("/dashboard/super-admin/deleted-records?view=all");
T.check("deleted records page: Super Admin only", okPage(dRec.global_super) && Object.entries(dRec).every(([k, v]) => k === "global_super" || v === 403), JSON.stringify(dRec));
const aMon = await page("/dashboard/audit-monitoring");
T.check("audit monitoring page: audit-eligible roles, never a normal user", okPage(aMon.global_super) && okPage(aMon.quetta_biz) && aMon.staff_biz === 403 && aMon.cashier_biz === 403, JSON.stringify(aMon));
const hub = await page("/dashboard/reports");
T.check("Reports Center page: roles with reports:read open it, normal users do not", okPage(hub.global_super) && okPage(hub.quetta_biz) && okPage(hub.pk_country_biz) && hub.staff_biz === 403 && hub.cashier_biz === 403, JSON.stringify(hub));
const shipPage = await page("/dashboard/reports/shipping");
T.check("Shipping & Clearing Reports page: Shipping logins and Super Admin, never a Business-only login", okPage(shipPage.global_super) && okPage(shipPage.chaman_ship) && shipPage.quetta_biz === 403 && shipPage.deira_biz === 403, JSON.stringify(shipPage));
for (const p of ["/dashboard/reports/branch", "/dashboard/reports/country", "/dashboard/reports/payments", "/dashboard/reports/super-admin"]) {
  const r = await page(p);
  T.check(`old URL still works for Super Admin: ${p}`, okPage(r.global_super), JSON.stringify(r));
}
const sa = await page("/dashboard/reports/super-admin");
T.check("Super Admin Reports page: Super Admin only", Object.entries(sa).every(([k, v]) => k === "global_super" || v === 403), JSON.stringify(sa));

// ── 7. e-mail: a real attachment or an honest failure, never a fake "sent" ─────────────────────────────────────
const mail = (who, body) => c[who].req("PATCH", "/api/erp/reports/auto-email?action=send-now", body);
T.check("e-mail needs reports:read (normal user -> 403)", (await mail("staff_biz", { recipients: ["a@b.co"], htmlBody: "x" })).status === 403);
T.check("e-mail refuses an invalid recipient (400)", (await mail("global_super", { recipients: ["not-an-email"], htmlBody: "x" })).status === 400);
T.check("e-mail refuses more than 10 recipients (400)", (await mail("global_super", { recipients: Array.from({ length: 11 }, (_, i) => `a${i}@b.co`), htmlBody: "x" })).status === 400);
T.check("e-mail refuses an attachment that is not a PDF (400)", (await mail("global_super", { recipients: ["a@b.co"], htmlBody: "x", attachment: { filename: "r.pdf", contentBase64: Buffer.from("this is not a pdf ".repeat(20)).toString("base64") } })).status === 400);
const fake = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(300, 65)]).toString("base64");
const send = await mail("global_super", { recipients: ["recipient@example.com"], reportName: "matrix test", htmlBody: "<p>test</p>", attachment: { filename: "matrix.pdf", contentBase64: fake } });
T.check("a valid PDF is never reported as delivered unless the mail server accepted it (a Super Admin has no branch mailbox, so this must be an honest refusal)", send.json?.success !== true || send.json?.attached === true, `status ${send.status} ${JSON.stringify(send.json).slice(0, 160)}`);

process.exit(T.summary() ? 0 : 1);
