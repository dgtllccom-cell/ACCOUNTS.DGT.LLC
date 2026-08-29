import fs from "node:fs";
import postgres from "postgres";

// Read the production pooler URL from the already-committed ops script.
// Never printed / logged.
const src = fs.readFileSync("scripts/backup-vps-db.mjs", "utf8");
const m = src.match(/postgresql:\/\/[^\s'"]+/);
if (!m) { console.error("could not locate prod DB URL"); process.exit(1); }
const PROD = m[0];
const sql = postgres(PROD, { max: 3, prepare: false, ssl: { rejectUnauthorized: false }, connect_timeout: 25 });

const action = process.argv[2] || "check";

if (action === "check") {
  const mine = [
    "20260914_contract_control_center","20260915_hr_departments_designations","20260916_hr_employment_history",
    "20260917_hr_employee_kyc","20260918_hr_attendance_leave","20260919_hr_payroll_runs","20260920_hr_payroll_tax_config",
    "20260921_hr_smart_crm_reminders","20260922_hr_gratuity_settlement","20260923_hr_country_currency","20260924_hr_onboarding",
    "20260925_document_intelligence_foundation","20260926_document_intake_drafts","20260927_purchase_loading_batches",
    "20260928_business_shipping_handovers","20260929_document_intake_roznamcha","20260930_hr_leave_attendance_reconciliation",
    "20261001_multicurrency_purchase_payment_fix",
  ];
  const rows = await sql`SELECT name, status, applied_at FROM public.erp_schema_migrations WHERE name = ANY(${mine}) ORDER BY name`;
  const applied = new Set(rows.map(r => r.name));
  console.log("PROD erp_schema_migrations — this release:");
  for (const n of mine) console.log(`  ${applied.has(n) ? "APPLIED " : "MISSING "} ${n}`);
  console.log(`\n${applied.size}/${mine.length} applied on production.`);
  // also: do the new function bodies match the fixed version?
  const fn = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_purchase_order_payment'`;
  console.log("\npost_purchase_order_payment on PROD is FIXED version:",
    /v_base_currency/.test(fn[0]?.d || "") ? "YES" : "NO (old version)");
  const fn2 = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='recalc_purchase_order_payment_totals'`;
  console.log("recalc_purchase_order_payment_totals on PROD is FIXED version:",
    /v_order_rate_to_base/.test(fn2[0]?.d || "") ? "YES" : "NO (old version)");
  const c = await sql`SELECT name, currency_code FROM public.countries WHERE iso2='AE' AND deleted_at IS NULL`;
  console.log("\nPROD UAE country:", JSON.stringify(c[0]));
}

await sql.end();
// (appended) size probe — run: npx tsx scratch/prod-ops.mjs size
