/**
 * Post-cleanup verification (DEV ONLY): 1) every transactional table empty, 2) masters preserved (counts vs the pre-cleanup
 * manifest), 3) ledgers / accounts reconcile to opening balances, 4) no orphan references from kept tables, 5) the module
 * APIs (as Super Admin) list no transactions. Env: BASE, ERP_COOKIE, MANIFEST (cleanup manifest.json), MASTERS_BEFORE (json).
 */
import fs from "node:fs";
import { withLocalPg, getDbUrl } from "@/lib/db/local-postgres";
import { DELETE_ORDER } from "./dev-transaction-cleanup-order";

if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("not DEV");
const BASE = process.env.BASE || "http://localhost:3000";
const COOKIE = process.env.ERP_COOKIE || "";
const mastersBefore = process.env.MASTERS_BEFORE ? JSON.parse(fs.readFileSync(process.env.MASTERS_BEFORE, "utf8")) : null;
export const MASTER_TABLES = ["enterprise_accounts", "ledgers", "customers", "employees", "companies", "banks", "warehouses", "goods", "products", "clearing_agents", "shipping_lines", "countries", "country_branches", "city_branches", "profiles", "user_role_assignments", "user_permission_sets", "account_categories", "account_types", "trucks", "ports", "hr_departments", "hr_designations", "uae_tax_entities", "uae_tax_rules", "tax_codes", "audit_logs", "approval_requests"];
const results: { area: string; name: string; pass: boolean; observed?: unknown }[] = [];
const ok = (area: string, name: string, pass: boolean, observed?: unknown) => { results.push({ area, name, pass, observed }); console.log(pass ? "PASS" : "FAIL", area, "-", name, JSON.stringify(observed ?? "")); };

const masters: Record<string, number> = {};
await withLocalPg(async (sql) => {
  for (const t of DELETE_ORDER) {
    if ((await sql`select to_regclass(${"public." + t}) r`)[0].r === null) continue;
    const [{ n }] = await sql.unsafe(`select count(*)::int n from public."${t}"`);
    ok("empty", t, n === 0, n);
  }
  for (const t of MASTER_TABLES) masters[t] = (await sql.unsafe(`select count(*)::int n from public."${t}"`))[0].n;
  if (mastersBefore) for (const t of MASTER_TABLES) ok("masters preserved", t, masters[t] === mastersBefore[t], { before: mastersBefore[t], after: masters[t] });
  const [l] = await sql`select count(*)::int n, count(*) filter (where debit_total<>0 or credit_total<>0 or current_balance<>coalesce(opening_balance,0))::int bad, coalesce(sum(opening_balance),0)::float8 op from ledgers`;
  ok("reconciliation", "every ledger: Dr = Cr = 0 and balance = opening balance", l.bad === 0, l);
  const [a] = await sql`select count(*)::int n, count(*) filter (where current_balance is distinct from coalesce(opening_balance,0))::int bad from enterprise_accounts`;
  ok("reconciliation", "every account: balance = opening balance", a.bad === 0, a);
  // orphans: kept rows that still point at a removed transaction
  const orphanChecks: [string, string][] = [
    ["document_intake_jobs.purchase_order_id", `select count(*)::int n from document_intake_jobs where purchase_order_id is not null`],
    ["document_intake_jobs.sales_order_id", `select count(*)::int n from document_intake_jobs where sales_order_id is not null`],
    ["uae_tax_periods.filed_return_id", `select count(*)::int n from uae_tax_periods where filed_return_id is not null`],
  ];
  for (const [name, q] of orphanChecks) ok("orphans", name, (await sql.unsafe(q))[0].n === 0, (await sql.unsafe(q))[0].n);
  const tasks = await sql`select related_record_table t, count(*)::int n from user_tasks where deleted_at is null and related_record_table = any(${DELETE_ORDER}::text[]) group by 1`;
  ok("orphans (workflow, informational)", "open tasks that pointed at removed transactions", true, tasks);
});

// module APIs as Super Admin: no transactions listed anywhere
const get = async (p: string) => {
  try { const r = await fetch(BASE + p, { headers: { cookie: COOKIE }, signal: AbortSignal.timeout(180000) }); return { status: r.status, body: await r.json().catch(() => null) }; }
  catch (e) { return { status: "ERR " + String(e).slice(0, 40), body: null }; }
};
const count = (b: any): number => {
  const d = b?.data ?? b;
  for (const k of ["records", "rows", "orders", "entries", "bills", "lines", "items", "purchaseOrders", "localPurchases", "transfers", "loads", "ledgers"]) if (Array.isArray(d?.[k])) return d[k].length;
  if (Array.isArray(d)) return d.length;
  return -1;
};
for (const [name, p] of [
  ["Purchase loading records", "/api/erp/purchases/loading-records?limit=50"],
  ["Transit & Lane", "/api/erp/purchases/lane"],
  ["Shipping / BL records", "/api/erp/shipping/bl-records?limit=50"],
  ["Customer orders", "/api/erp/clearing-agent/customer-order"],
  ["Money exchange", "/api/erp/money-exchange?limit=50"],
  ["Expense bills", "/api/erp/expenses?limit=50"],
  ["Ledger general report (entries)", "/api/erp/accounting/reports/ledger/general?reportScope=super_admin"],
] as const) {
  const r = await get(p);
  const n = count(r.body);
  const entries = name.startsWith("Ledger") ? (r.body?.data?.summary?.entries ?? -1) : n;
  ok("module API", `${name} lists no transactions`, r.status === 200 && entries === 0, { status: r.status, rows: entries });
}
const fail = results.filter((r) => !r.pass);
console.log(`\nTOTAL ${results.length - fail.length}/${results.length} PASS`);
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ at: new Date().toISOString(), masters, results }, null, 2));
process.exit(fail.length ? 1 : 0);
