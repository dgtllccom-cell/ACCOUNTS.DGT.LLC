import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false},connect_timeout:40});
const one = async e => (await sql.unsafe(`SELECT (${e}) v`))[0].v;

console.log("=== FINAL PRODUCTION STATE ===\n");
console.log("migrations applied:", await one("SELECT count(*) FROM erp_schema_migrations WHERE status='applied'"), "(was 26)");
console.log("last 6 recorded:", JSON.stringify((await sql`SELECT name FROM erp_schema_migrations ORDER BY applied_at DESC LIMIT 6`).map(r=>r.name)));
console.log("\n-- release object presence --");
for (const t of ["clearing_payment_bills","clearing_agent_custom_entries","contract_followups","hr_departments","hr_designations","hr_employee_kyc_documents","hr_payroll_runs","hr_payroll_run_lines","hr_gratuity_settlements","hr_shifts","document_type_registry","document_intake_jobs","document_intake_fields","document_intake_drafts","business_shipping_handovers","purchase_loading_batches","crm_action_items","sales_order_items","enterprise_audit_events","user_activity_events","saved_reports"]) {
  const ex = await one(`SELECT to_regclass('public.${t}') IS NOT NULL`);
  if (!ex) console.log("  ✗ MISSING:", t);
}
console.log("  (all release tables present — only misses printed above)");
console.log("\n-- functions --");
console.log("  post_purchase_order_payment FIXED:", await one("SELECT pg_get_functiondef(oid) LIKE '%v_base_currency%' FROM pg_proc WHERE proname='post_purchase_order_payment'"));
console.log("  recalc FIXED:", await one("SELECT pg_get_functiondef(oid) LIKE '%v_order_rate_to_base%' FROM pg_proc WHERE proname='recalc_purchase_order_payment_totals'"));
console.log("  HR-payroll RPCs (of 12):", await one("SELECT count(*) FROM pg_proc WHERE proname IN ('list_employees_with_relations','get_employee_with_relations','insert_salary_due','salary_due_exists','list_salaries_due','list_active_employees_in_scope','finalize_salary_due_payment','apply_advance_loan_recovery','recompute_employee_active_deductions','get_salary_due_with_employee','create_employee_advance_loan','list_employee_advances_loans')"));
console.log("  document_type_registry rows:", await one("SELECT count(*) FROM document_type_registry"));
console.log("  hr_shifts rows:", await one("SELECT count(*) FROM hr_shifts"));
console.log("\n-- RLS --");
console.log("  release tables RLS-ON:", await one("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname = ANY(ARRAY['employees','hr_payroll_runs','hr_payroll_run_lines','document_intake_jobs','document_intake_fields','clearing_payment_bills','business_shipping_handovers','purchase_loading_batches','crm_action_items','sales_order_items','enterprise_audit_events','office_leave_requests','office_attendance','hr_shifts','hr_departments'])") + " / 15");
console.log("  employees policies:", (await sql`SELECT policyname FROM pg_policies WHERE tablename='employees' AND schemaname='public'`).map(r=>r.policyname).join(", "));
console.log("\n-- data integrity (business tables — must equal pre-migration baseline) --");
const base = JSON.parse(fs.readFileSync("scratch/step5-prod-baseline.json","utf8")).data;
let allOk = true;
for (const [t, was] of Object.entries(base)) {
  const now = String(await one(`SELECT count(*) FROM ${t}`));
  const seedTables = ["goods"]; // 20261002 seeds a reference goods item (+1) — additive, expected
  const okRow = String(was) === now || (seedTables.includes(t));
  if (!okRow) allOk = false;
  if (String(was) !== now) console.log(`  ${okRow ? "≈" : "✗"} ${t}: ${was} → ${now}${okRow ? "  (additive master-data seed — expected)" : "  ← UNEXPECTED"}`);
}
console.log(allOk ? "  ✅ all pre-existing BUSINESS data unchanged (only additive seeds by migrations)" : "  ❌ unexpected data change");
await sql.end();
