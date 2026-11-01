/**
 * Read-only, UNAUTHENTICATED checks of the live site after a gated deployment. It never logs in and never writes.
 *   node scripts/production/verify-live-public.mjs [https://host]
 * Proves: every protected page sends a signed-out visitor to sign-in (no 200, no 500), every protected API answers 401/403 (never data), and the
 * DEV-only session bootstrap is inert on Production.
 */
const BASE = (process.argv[2] || "https://api.dgt.llc").replace(/\/$/, "");
const NIL = "00000000-0000-0000-0000-000000000000";
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`); };
const hit = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, redirect: "manual", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  await r.arrayBuffer().catch(() => {});
  return { status: r.status, location: r.headers.get("location") || "" };
};

const PAGES = [
  "/dashboard/reports", "/dashboard/reports/handover", "/dashboard/general-office/employee-kyc?tab=report", "/dashboard/documents", "/dashboard/crm",
  "/dashboard/ledger/general-report", "/dashboard/reports/journal", "/dashboard/ledger/outstanding", "/dashboard/ledger/detailed",
  "/dashboard/reports/country", "/dashboard/qvc", "/dashboard/consignment", "/dashboard/general-office/payroll-reconciliation"
];
for (const p of PAGES) {
  const r = await hit("GET", p);
  check(`page ${p} sends a signed-out visitor to sign-in`, [301, 302, 303, 307, 308].includes(r.status) && /login|sign-?in|auth/i.test(r.location), `${r.status} -> ${r.location}`);
}
const APIS = [
  "/api/documents", `/api/documents/download?id=${NIL}`, `/api/documents/${NIL}/audit`, "/api/erp/hr/kyc", "/api/erp/hr/kyc/kpis", `/api/erp/hr/kyc/${NIL}`,
  `/api/erp/hr/kyc/documents/${NIL}/file`, "/api/erp/kyc/reports", "/api/erp/reports/journal", "/api/erp/accounting/reports/ledger/outstanding",
  "/api/erp/accounting/reports/ledger/general", "/api/erp/crm/payables-receivables", "/api/erp/crm/dashboard", `/api/erp/crm/customer-360?customerId=${NIL}`,
  "/api/erp/reports/handover-summary", "/api/erp/reports/handover-pdf", `/api/erp/reports/record?table=ledger_posting_batches&id=${NIL}`, "/api/erp/reports/country?domain=business"
];
for (const a of APIS) {
  const r = await hit("GET", a);
  check(`api GET ${a.split("?")[0].replace(NIL, ":id")} gives no data when signed out`, [401, 403].includes(r.status) || ([301, 302, 303, 307, 308].includes(r.status) && /login|sign-?in|auth/i.test(r.location)), `${r.status}`);
}
const w = await hit("POST", "/api/erp/kyc/reports", { entityType: "city_branch", entityId: NIL, ownerName: "x" });
check("api POST /api/erp/kyc/reports (forged write) is refused when signed out (sign-in redirect / 401 / 403)", [401, 403].includes(w.status) || ([301, 302, 303, 307, 308].includes(w.status) && /login|sign-?in|auth/i.test(w.location)), `${w.status}`);
const dev = await hit("POST", "/api/erp/auth/dev-session", { role: "super_admin" });
check("the DEV-only session bootstrap is inert on Production (404)", dev.status === 404, `${dev.status}`);
console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
