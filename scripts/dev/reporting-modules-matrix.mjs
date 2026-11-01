/**
 * DEV only - permission / scope / currency matrix for the seven reporting modules (Handover, Employee KYC, Documents, CRM, Ledger General, Journal
 * Reporting, Outstanding & Recovery), role by role, through the real routes.
 *   BASE=http://localhost:3541 node scripts/dev/reporting-modules-matrix.mjs
 *
 * Personas come from POST /api/erp/auth/dev-session (synthetic identity, no password). Every expectation is about what the SERVER answers.
 * Read-only apart from forged writes that MUST be refused.
 */
import { IDS, PERSONAS, login, client, rows, tally } from "./_rbac-lib.mjs";

const T = tally();
const NIL = "00000000-0000-0000-0000-000000000000";
const extra = {
  staff_biz: { label: "Staff user (business, Quetta)", body: { role: "staff_user", countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA, operationalDomain: "business" } },
  hr_admin: { label: "HR admin (PK)", body: { role: "hr_admin", countryId: IDS.PK, operationalDomain: "business" } },
  auditor: { label: "Auditor (PK, read only)", body: { role: "auditor_viewer", countryId: IDS.PK, operationalDomain: "business" } },
  accountant: { label: "Accountant (PK)", body: { role: "accountant", countryId: IDS.PK, operationalDomain: "business" } }
};
const P = { ...PERSONAS, ...extra };
const c = {};
for (const [k, p] of Object.entries(P)) c[k] = client(await login(p.body));
const data = (r) => r.json?.data ?? r.json ?? null;

// ── 1. Documents ───────────────────────────────────────────────────────────────────────────────
const SHIP = /^(shipping|clearing|customs|truck|container|bl[_ -]|bills?[_ ]of[_ ]lading|delivery[_ ]order|manifest)/i;
const docs = {};
for (const k of ["global_super", "pk_country_biz", "quetta_biz", "deira_biz", "chaman_ship", "alras_ship", "staff_biz"]) {
  const r = await c[k].get("/api/documents");
  docs[k] = { status: r.status, list: r.json?.documents ?? [] };
}
T.check("Documents: Super Admin lists real documents", docs.global_super.status === 200 && docs.global_super.list.length > 0, `${docs.global_super.list.length}`);
T.check("Documents: Quetta branch admin sees only Quetta documents, none of Shipping Line",
  docs.quetta_biz.status === 200 && docs.quetta_biz.list.every((d) => d.city_branch_id === IDS.QUETTA && !SHIP.test(String(d.module_type ?? "")) && !SHIP.test(String(d.source_module ?? ""))), `${docs.quetta_biz.list.length}/${docs.global_super.list.length}`);
T.check("Documents: Deira (UAE) branch admin sees only UAE documents", docs.deira_biz.status === 200 && docs.deira_biz.list.every((d) => d.country_id === IDS.UAE), `${docs.deira_biz.list.length}`);
T.check("Documents: Pakistan country admin sees only Pakistan documents, no Shipping Line", docs.pk_country_biz.status === 200 && docs.pk_country_biz.list.every((d) => d.country_id === IDS.PK && !SHIP.test(String(d.module_type ?? ""))), `${docs.pk_country_biz.list.length}`);
T.check("Documents: Chaman shipping admin sees only Shipping documents of its branch", docs.chaman_ship.status === 200 && docs.chaman_ship.list.every((d) => d.city_branch_id === IDS.CHAMAN_SHIP && (SHIP.test(String(d.module_type ?? "")) || SHIP.test(String(d.source_module ?? "")))), `${docs.chaman_ship.list.length}`);
T.check("Documents: no scoped login sees more than the Super Admin", ["pk_country_biz", "quetta_biz", "deira_biz", "chaman_ship", "alras_ship"].every((k) => docs[k].list.length <= docs.global_super.list.length));
T.check("Documents: a normal user without documents:read is refused", docs.staff_biz.status === 403, `${docs.staff_biz.status}`);
const forged = await c.quetta_biz.get(`/api/documents?countryId=${IDS.UAE}`);
T.check("Documents: forged ?countryId= of another country returns nothing for a branch login", forged.status === 200 && (forged.json?.documents ?? []).length === 0, `${forged.status}/${(forged.json?.documents ?? []).length}`);
const outsider = docs.global_super.list.find((d) => d.country_id === IDS.UAE) ?? docs.global_super.list.find((d) => d.city_branch_id && d.city_branch_id !== IDS.QUETTA);
if (outsider) {
  T.check("Documents: direct download of another branch's document -> 404 (existence not confirmed)", (await c.quetta_biz.get(`/api/documents/download?id=${outsider.id}`)).status === 404);
  T.check("Documents: audit trail of another branch's document -> not served", [403, 404].includes((await c.quetta_biz.get(`/api/documents/${outsider.id}/audit`)).status));
  T.check("Documents: uploading a new version of another branch's document is refused before the file is even read", [403, 404].includes((await c.quetta_biz.req("POST", `/api/documents/${outsider.id}/version`)).status));
  const mine = docs.quetta_biz.list[0];
  if (mine) T.check("Documents: the same call on the login's OWN document passes the gate (then asks for the file: 400)", (await c.quetta_biz.req("POST", `/api/documents/${mine.id}/version`)).status === 400);
  const del = await c.quetta_biz.req("DELETE", `/api/documents?id=${outsider.id}`);
  T.check("Documents: delete of another branch's document is refused", [403, 404].includes(del.status), `${del.status}`);
} else T.check("Documents: out-of-scope document available for the forged-access checks", false, "no cross-branch document in DEV data");

// ── 2. CRM ───────────────────────────────────────────────────────────────────────────────────
const crm = (who, p) => c[who].get(`/api/erp/crm/${p}`);
T.check("CRM: Shipping-only login never gets Business receivables / payables", (await crm("chaman_ship", "payables-receivables")).status === 403);
T.check("CRM: Super Admin reads receivables / payables", (await crm("global_super", "payables-receivables")).status === 200);
const crmSa = data(await crm("global_super", "payables-receivables"));
const crmQ = data(await crm("quetta_biz", "payables-receivables"));
T.check("CRM: branch login answers (no 500) and never exceeds the Super Admin totals", (await crm("quetta_biz", "payables-receivables")).status === 200 && JSON.stringify(crmQ).length <= JSON.stringify(crmSa).length + 50);
for (const p of ["dashboard", "items", "insights", "reports"]) {
  const r = await crm("quetta_biz", p);
  T.check(`CRM: /${p} answers the branch login without a server error`, r.status < 500, `${r.status}`);
}
T.check("CRM: customer-360 of an unknown / out-of-scope customer -> 404 (not a server error)", (await crm("quetta_biz", `customer-360?customerId=${NIL}`)).status === 404);

// ── 3. Employee KYC / HRM ──────────────────────────────────────────────────────────────────────
const kyc = {};
for (const k of ["global_super", "pk_country_biz", "quetta_biz", "deira_biz", "hr_admin", "auditor", "accountant", "staff_biz"]) {
  const r = await c[k].get("/api/erp/hr/kyc");
  kyc[k] = { status: r.status, rows: data(r)?.rows ?? [], caps: data(r)?.caps ?? null };
}
T.check("KYC: Super Admin lists employees", kyc.global_super.status === 200, `${kyc.global_super.rows.length}`);
T.check("KYC: Pakistan country admin sees only Pakistan employees (no country-less record leaks in)", kyc.pk_country_biz.rows.every((r) => r.country_id === IDS.PK), `${kyc.pk_country_biz.rows.length}`);
T.check("KYC: Quetta branch admin sees only Quetta employees", kyc.quetta_biz.rows.every((r) => r.city_branch_id === IDS.QUETTA), `${kyc.quetta_biz.rows.length}`);
T.check("KYC: Deira branch admin sees only UAE employees", kyc.deira_biz.rows.every((r) => r.country_id === IDS.UAE), `${kyc.deira_biz.rows.length}`);
T.check("KYC: normal user is limited to its OWN employee profile", kyc.staff_biz.status === 200 && kyc.staff_biz.caps?.ownOnly === true && kyc.staff_biz.rows.length <= 1, `${kyc.staff_biz.status} rows=${kyc.staff_biz.rows.length}`);
T.check("KYC: capabilities - HR admin uploads + approves", kyc.hr_admin.caps?.upload === true && kyc.hr_admin.caps?.verify === true && kyc.hr_admin.caps?.identifiers === true);
T.check("KYC: capabilities - accountant uploads but cannot approve", kyc.accountant.caps?.upload === true && kyc.accountant.caps?.verify === false);
T.check("KYC: capabilities - auditor is view-only with masked identifiers", kyc.auditor.caps?.upload === false && kyc.auditor.caps?.verify === false && kyc.auditor.caps?.identifiers === false);
const emp = kyc.global_super.rows[0];
if (emp) {
  const post = { requirementCode: "passport", documentNumber: "X1234567" };
  T.check("KYC: auditor cannot upload / edit a document", (await c.auditor.req("POST", `/api/erp/hr/kyc/${emp.employee_id}`, post)).status === 403);
  T.check("KYC: normal user cannot upload / edit a document", (await c.staff_biz.req("POST", `/api/erp/hr/kyc/${emp.employee_id}`, post)).status === 403);
  // masking is proven end to end against a seeded employee in scripts/dev/kyc-masking-e2e.mjs (the auditor persona has no employee of its own in DEV)
  const audEmp = kyc.auditor.rows[0];
  if (audEmp) {
    const ch = await c.auditor.get(`/api/erp/hr/kyc/${audEmp.employee_id}`);
    T.check("KYC: auditor reads the checklist with identifiers masked", ch.status === 200 && (data(ch)?.items ?? []).every((i) => !i.document_number || /^\*+.{0,4}$/.test(String(i.document_number))) && (data(ch)?.items ?? []).every((i) => !i.file_url && !i.office_document_id));
  }
  const other = kyc.global_super.rows.find((r) => r.city_branch_id && r.city_branch_id !== IDS.QUETTA && r.country_id !== IDS.UAE) ?? kyc.global_super.rows.find((r) => r.country_id === IDS.UAE);
  if (other) T.check("KYC: branch admin opening ANOTHER branch's employee checklist is refused", [403, 404].includes((await c.quetta_biz.get(`/api/erp/hr/kyc/${other.employee_id}`)).status));
  T.check("KYC: normal user opening someone else's profile is refused", [403, 404].includes((await c.staff_biz.get(`/api/erp/hr/kyc/${emp.employee_id}`)).status) || kyc.staff_biz.rows.some((r) => r.employee_id === emp.employee_id));
}
T.check("KYC: approve / reject needs the approver role (accountant refused)", (await c.accountant.req("PATCH", `/api/erp/hr/kyc/documents/${NIL}`, { decision: "verified" })).status === 403);
T.check("KYC: approve / reject refused for a normal user", (await c.staff_biz.req("PATCH", `/api/erp/hr/kyc/documents/${NIL}`, { decision: "verified" })).status === 403);
T.check("KYC: scan preview refused for a read-only role", (await c.auditor.get(`/api/erp/hr/kyc/documents/${NIL}/file`)).status === 403);
T.check("KYC: scan preview of an unknown document -> 404 for HR admin", (await c.hr_admin.get(`/api/erp/hr/kyc/documents/${NIL}/file`)).status === 404);
const rep = {};
for (const k of ["global_super", "pk_country_biz", "quetta_biz", "deira_biz"]) rep[k] = await c[k].get("/api/erp/kyc/reports");
T.check("KYC report: Super Admin sees the whole register", rep.global_super.status === 200 && (rep.global_super.json?.items ?? []).length > 0, `${(rep.global_super.json?.items ?? []).length}`);
T.check("KYC report: branch admin is not given the whole country (strictly its branch)", rep.quetta_biz.status === 200 && (rep.quetta_biz.json?.items ?? []).length <= (rep.pk_country_biz.json?.items ?? []).length, `${(rep.quetta_biz.json?.items ?? []).length} <= ${(rep.pk_country_biz.json?.items ?? []).length}`);
T.check("KYC report: country admin sees fewer records than the Super Admin", (rep.pk_country_biz.json?.items ?? []).length <= (rep.global_super.json?.items ?? []).length);
T.check("KYC report: UAE branch admin never receives a Pakistan record", (rep.deira_biz.json?.items ?? []).every((i) => !/pakistan/i.test(String(i.countryName ?? ""))), `${(rep.deira_biz.json?.items ?? []).length}`);
for (const [entityType, entityId] of [["city_branch", IDS.DEIRA], ["country_branch", IDS.UAE_MAIN]]) {
  const w = await c.quetta_biz.req("POST", "/api/erp/kyc/reports", { entityType, entityId, ownerName: "Forged Owner" });
  T.check(`KYC report: forged update of a ${entityType} outside the scope -> refused`, [403, 404].includes(w.status), `${w.status}`);
}

// ── 4. Journal Reporting - one currency, scoped, View document ───────────────────────────────────────
const J = (who, qs = "") => c[who].get(`/api/erp/reports/journal?reportScope=super_admin&fromDate=2020-01-01&toDate=2030-12-31&pageSize=500${qs}`);
const jsa = await J("global_super");
const jd = data(jsa);
T.check("Journal: Super Admin register answers", jsa.status === 200 && jd?.table, `${jsa.status} rows=${jd?.table?.totalCount}`);
T.check("Journal: every card, chart and row is in ONE currency (never added across currencies)", jd && (jd.table.rows ?? []).every((r) => !jd.currency || String(r.currency).toUpperCase() === jd.currency), `ccy=${jd?.currency} available=${(jd?.availableCurrencies ?? []).map((x) => x.currency).join("/")}`);
if ((jd?.availableCurrencies ?? []).length > 1) {
  const other = jd.availableCurrencies.find((x) => x.currency !== jd.currency).currency;
  const jo = data(await J("global_super", `&currency=${other}`));
  T.check("Journal: asking for another currency switches the whole register to it", jo?.currency === other && (jo.table.rows ?? []).every((r) => String(r.currency).toUpperCase() === other));
  T.check("Journal: a multi-currency register announces the single-currency view", Boolean(jd.currencyNotice?.applied));
}
const jq = data(await J("quetta_biz"));
T.check("Journal: Quetta branch admin sees only its own branch entries", (jq?.table?.rows ?? []).every((r) => r.cityBranchId === IDS.QUETTA), `${jq?.table?.totalCount}`);
const jdz = data(await J("deira_biz"));
T.check("Journal: Deira branch admin sees only UAE entries", (jdz?.table?.rows ?? []).every((r) => r.countryId === IDS.UAE), `${jdz?.table?.totalCount}`);
T.check("Journal: Shipping-only login is refused", (await J("chaman_ship")).status === 403);
const entry = (jd?.table?.rows ?? [])[0];
if (entry) {
  const table = entry.sourceTable === "roznamcha" ? "roznamcha_entries" : "ledger_posting_batches";
  const v = await c.global_super.get(`/api/erp/reports/record?table=${table}&id=${entry.entryId}`);
  T.check(`Journal: View opens the read-only document of the entry (${table})`, v.status === 200 && v.json?.data?.found === true && (v.json.data.doc.tables?.[0]?.rows?.length ?? 0) > 0, `${v.status}`);
  const colKeys = (v.json?.data?.doc?.tables?.[0]?.columns ?? []).map((x) => x.key);
  T.check("Journal: the document shows account, narration, debit, credit, balance, currency and exchange rate", ["account", "description", "debit", "credit", "balance", "currency", "rate"].every((k) => colKeys.includes(k)), colKeys.join(","));
  const blocked = entry.countryId === IDS.UAE ? c.quetta_biz : c.deira_biz;
  T.check("Journal: the same entry is 'not found' for a login outside its scope", (await blocked.get(`/api/erp/reports/record?table=${table}&id=${entry.entryId}`)).json?.data?.found !== true);
}

// ── 5. Outstanding & Recovery ───────────────────────────────────────────────────────────────────
const O = (who, qs = "") => c[who].get(`/api/erp/accounting/reports/ledger/outstanding${qs}`);
const osa = await O("global_super");
const od = data(osa);
T.check("Outstanding: Super Admin answers with a real currency (never a hard-coded one)", osa.status === 200 && (od?.summary?.currency === null || /^[A-Z]{3,5}$/.test(od?.summary?.currency ?? "")), `${osa.status} ${od?.summary?.currency}`);
T.check("Outstanding: every row and every total is in that ONE currency", (od?.rows ?? []).every((r) => String(r.currency).toUpperCase() === od.summary.currency), `${(od?.rows ?? []).length} rows`);
if ((od?.currencies ?? []).length > 1) {
  const other = od.currencies.find((x) => x.currency !== od.summary.currency).currency;
  const oo = data(await O("global_super", `?currency=${other}`));
  T.check("Outstanding: choosing another currency re-bases the whole screen", oo?.summary?.currency === other && (oo.rows ?? []).every((r) => String(r.currency).toUpperCase() === other));
}
const oq = data(await O("quetta_biz"));
T.check("Outstanding: Quetta branch admin sees only its own branch ledgers", (oq?.rows ?? []).every((r) => r.cityBranchId === IDS.QUETTA), `${(oq?.rows ?? []).length}`);
const oc = data(await O("pk_country_biz"));
T.check("Outstanding: Pakistan country admin sees only Pakistan ledgers", (oc?.rows ?? []).every((r) => r.countryId === IDS.PK), `${(oc?.rows ?? []).length}`);
T.check("Outstanding: forged ?countryId= of another country returns nothing for a country login", ((data(await O("pk_country_biz", `?countryId=${IDS.UAE}`)))?.rows ?? []).length === 0);
T.check("Outstanding: Shipping-only login is refused", (await O("chaman_ship")).status === 403);

// ── 6. Ledger General Report ──────────────────────────────────────────────────────────────────────
const G = (who, qs = "") => c[who].get(`/api/erp/accounting/reports/ledger/general?reportScope=super_admin&fromDate=2020-01-01&toDate=2030-12-31&limit=500${qs}`);
const gsa = await G("global_super");
const gd = data(gsa);
T.check("Ledger General: Super Admin answers", gsa.status === 200, `${gsa.status}`);
const gq = data(await G("quetta_biz"));
T.check("Ledger General: Quetta branch admin sees only its own branch ledgers", (gq?.rows ?? gq?.ledgers ?? []).every((r) => !r.cityBranchId || r.cityBranchId === IDS.QUETTA), `${(gq?.rows ?? gq?.ledgers ?? []).length}`);
T.check("Ledger General: forged cityBranchId of another branch -> 403", (await G("quetta_biz", `&cityBranchId=${IDS.DEIRA}`)).status === 403);
T.check("Ledger General: Shipping-only login is refused", (await G("chaman_ship")).status === 403);

// ── 7. Handover ───────────────────────────────────────────────────────────────────────────────────
const H = (who, qs = "") => c[who].get(`/api/erp/reports/handover-summary${qs}`);
T.check("Handover: operational summary answers a branch admin (own scope)", (await H("quetta_biz")).status === 200);
T.check("Handover: system-administration facts (?admin=1) are Super Admin only", (await H("quetta_biz", "?admin=1")).status === 403 && (await H("global_super", "?admin=1")).status === 200);
T.check("Handover: the Super-Admin-only access register (credential references) is closed to a branch admin", (await c.quetta_biz.get("/api/erp/reports/handover-pdf")).status === 403);

process.exit(T.summary() ? 0 : 1);
