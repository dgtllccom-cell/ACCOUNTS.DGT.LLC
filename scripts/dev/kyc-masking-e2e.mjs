/**
 * DEV only - end-to-end check of the Employee KYC protections against ONE seeded test employee in the Quetta branch.
 *   EMP=<employee id> DOC=<kyc document id> BASE=http://localhost:3541 node scripts/dev/kyc-masking-e2e.mjs
 * (the employee / document are created and removed by a DEV fixture; the passport number is AB1234567 and it carries a file reference)
 */
import { IDS, login, client, tally } from "./_rbac-lib.mjs";

const EMP = process.env.EMP;
const DOC = process.env.DOC;
if (!EMP || !DOC) throw new Error("EMP and DOC env vars are required");
const T = tally();
const at = (role, over = {}) => ({ role, countryId: IDS.PK, countryBranchId: IDS.PK_MAIN, cityBranchId: IDS.QUETTA, operationalDomain: "business", ...over });
const who = {
  super: { role: "super_admin" },
  hr: at("hr_admin"),
  branch_admin: at("city_branch_admin"),
  accountant: at("accountant"),
  auditor: at("auditor_viewer"),
  staff: at("staff_user"),
  deira: { role: "city_branch_admin", countryId: IDS.UAE, countryBranchId: IDS.UAE_MAIN, cityBranchId: IDS.DEIRA, operationalDomain: "business" }
};
const c = {};
for (const [k, b] of Object.entries(who)) c[k] = client(await login(b));
const data = (r) => r.json?.data ?? null;
const item = (r) => (data(r)?.items ?? []).find((i) => i.document_id === DOC);

// who can SEE the employee
for (const k of ["super", "hr", "branch_admin", "accountant", "auditor"]) {
  const l = await c[k].get("/api/erp/hr/kyc");
  T.check(`${k}: the Quetta employee is in the register`, l.status === 200 && (data(l)?.rows ?? []).some((r) => r.employee_id === EMP), `${l.status}`);
}
for (const k of ["staff", "deira"]) {
  const l = await c[k].get("/api/erp/hr/kyc");
  T.check(`${k}: the Quetta employee is NOT in the register`, l.status === 200 && !(data(l)?.rows ?? []).some((r) => r.employee_id === EMP), `${l.status}`);
  const ch = await c[k].get(`/api/erp/hr/kyc/${EMP}`);
  T.check(`${k}: opening the checklist directly is refused`, [403, 404].includes(ch.status), `${ch.status}`);
}

// identity data
const full = await c.hr.get(`/api/erp/hr/kyc/${EMP}`);
T.check("hr_admin sees the passport number in full and the file reference", item(full)?.document_number === "AB1234567" && Boolean(item(full)?.file_url) && data(full)?.caps?.identifiers === true, `${item(full)?.document_number}`);
const ba = await c.branch_admin.get(`/api/erp/hr/kyc/${EMP}`);
T.check("branch admin sees the passport number in full", item(ba)?.document_number === "AB1234567");
const aud = await c.auditor.get(`/api/erp/hr/kyc/${EMP}`);
T.check("auditor sees the passport number MASKED (last four only)", item(aud)?.document_number === "*****4567", `${item(aud)?.document_number}`);
T.check("auditor never receives the file reference or the scan id", !item(aud)?.file_url && !item(aud)?.office_document_id && item(aud)?.file_hidden === true);
T.check("the raw response for the auditor does not contain the full number anywhere", !aud.text.includes("AB1234567") && !aud.text.includes("example.test/scan"));
T.check("auditor: scan preview is refused", (await c.auditor.get(`/api/erp/hr/kyc/documents/${DOC}/file`)).status === 403);
T.check("hr_admin: a document without a stored file answers 404 (no scan attached)", (await c.hr.get(`/api/erp/hr/kyc/documents/${DOC}/file`)).status === 404);
T.check("deira (other country): scan preview answers 404 - existence not confirmed", (await c.deira.get(`/api/erp/hr/kyc/documents/${DOC}/file`)).status === 404);

// upload / edit / approve separation
const post = { requirementCode: "passport", documentNumber: "AB1234567" };
T.check("auditor cannot upload / edit", (await c.auditor.req("POST", `/api/erp/hr/kyc/${EMP}`, post)).status === 403);
T.check("staff cannot upload / edit", (await c.staff.req("POST", `/api/erp/hr/kyc/${EMP}`, post)).status === 403);
T.check("deira cannot upload / edit another country's employee", [403, 404].includes((await c.deira.req("POST", `/api/erp/hr/kyc/${EMP}`, post)).status));
T.check("accountant may upload / edit", [200, 201].includes((await c.accountant.req("POST", `/api/erp/hr/kyc/${EMP}`, post)).status));
T.check("accountant cannot approve", (await c.accountant.req("PATCH", `/api/erp/hr/kyc/documents/${DOC}`, { decision: "verified" })).status === 403);
T.check("auditor cannot approve", (await c.auditor.req("PATCH", `/api/erp/hr/kyc/documents/${DOC}`, { decision: "verified" })).status === 403);
T.check("deira cannot approve another country's document", [403, 404].includes((await c.deira.req("PATCH", `/api/erp/hr/kyc/documents/${DOC}`, { decision: "verified" })).status));
const ok = await c.hr.req("PATCH", `/api/erp/hr/kyc/documents/${DOC}`, { decision: "verified" });
T.check("hr_admin (approver) can approve", ok.status === 200 && data(ok)?.result?.status === "verified", `${ok.status}`);
const rej = await c.branch_admin.req("PATCH", `/api/erp/hr/kyc/documents/${DOC}`, { decision: "rejected", reason: "matrix test" });
T.check("branch admin (approver) can reject", rej.status === 200 && data(rej)?.result?.status === "rejected", `${rej.status}`);

// the KYC KPIs follow the same scope
const k1 = data(await c.hr.get("/api/erp/hr/kyc/kpis"))?.kpis;
const k2 = data(await c.deira.get("/api/erp/hr/kyc/kpis"))?.kpis;
T.check("KPIs are scoped: the UAE branch admin counts fewer employees than the Pakistan HR admin", (k2?.total ?? 0) <= (k1?.total ?? 0), `${k2?.total} <= ${k1?.total}`);

process.exit(T.summary() ? 0 : 1);
