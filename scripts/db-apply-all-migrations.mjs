import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

function loadEnv() {
  return { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
}

const env = loadEnv();

// Target selection: default = DATABASE_URL (the env the VPS/dev runs against).
// `--target=prod` / `MIGRATE_TARGET=prod` uses PROD_DATABASE_URL so a maintainer
// can apply the additive migrations to production from a trusted machine without
// SSH. The destructive-migration guard below still applies to every target.
const target = (process.argv.find((a) => a.startsWith("--target="))?.split("=")[1]
  || process.env.MIGRATE_TARGET || "default").toLowerCase();
const DB_URL =
  target === "prod" ? (env.PROD_DATABASE_URL || process.env.PROD_DATABASE_URL) :
  target === "dev"  ? (env.DEV_DATABASE_URL || process.env.DEV_DATABASE_URL || env.DATABASE_URL) :
  env.DATABASE_URL;
if (!DB_URL) {
  console.error(`Connection URL not set for target "${target}" (need ${target === "prod" ? "PROD_DATABASE_URL" : "DATABASE_URL"} in .env.local)`);
  process.exit(1);
}
console.log(`[migrate] target: ${target}`);
env.DATABASE_URL = DB_URL;

const migrations = [
  { name: "20260812_roznamcha_posting_idempotency_and_category", path: "supabase/migrations/20260812_roznamcha_posting_idempotency_and_category.sql" },
  { name: "20260814_per_language_tables", path: "supabase/migrations/20260814_per_language_tables.sql" },
  { name: "20260815_fix_cash_entry_and_daily_rate_rpcs", path: "supabase/migrations/20260815_fix_cash_entry_and_daily_rate_rpcs.sql" },
  { name: "20260816_fix_per_language_resolution", path: "supabase/migrations/20260816_fix_per_language_resolution.sql" },
  { name: "20260816_bank_cheque_roznamcha_system", path: "supabase/migrations/20260816_bank_cheque_roznamcha_system.sql" },
  { name: "20260817_fix_banks_branch_code_nullable", path: "supabase/migrations/20260817_fix_banks_branch_code_nullable.sql" },
  { name: "20260827_step1_accounting_architecture", path: "supabase/migrations/20260827_step1_accounting_architecture.sql" },
  { name: "20260828_settlement_reconciliation_engine", path: "supabase/migrations/20260828_settlement_reconciliation_engine.sql" },
  { name: "20260829_settlement_integration_registry", path: "supabase/migrations/20260829_settlement_integration_registry.sql" },
  { name: "20260901_uae_tax_einvoicing_foundation", path: "supabase/migrations/20260901_uae_tax_einvoicing_foundation.sql" },
  { name: "20260902_uae_tax_ingestion", path: "supabase/migrations/20260902_uae_tax_ingestion.sql" },
  { name: "20260903_uae_tax_documents", path: "supabase/migrations/20260903_uae_tax_documents.sql" },
  { name: "20260904_uae_vat_return", path: "supabase/migrations/20260904_uae_vat_return.sql" },
  { name: "20260905_uae_tax_ledger_reconciliation", path: "supabase/migrations/20260905_uae_tax_ledger_reconciliation.sql" },
  { name: "20260906_uae_import_export_einvoicing", path: "supabase/migrations/20260906_uae_import_export_einvoicing.sql" },
  { name: "20260907_uae_tax_reports_audit", path: "supabase/migrations/20260907_uae_tax_reports_audit.sql" },
  { name: "20260908_uae_tax_finalize_fixes", path: "supabase/migrations/20260908_uae_tax_finalize_fixes.sql" },
  { name: "20260909_uae_tax_view_hardening", path: "supabase/migrations/20260909_uae_tax_view_hardening.sql" },
  { name: "20260910_uae_tax_rules_dedupe", path: "supabase/migrations/20260910_uae_tax_rules_dedupe.sql" },
  { name: "20260911_uae_tax_order_item_triggers", path: "supabase/migrations/20260911_uae_tax_order_item_triggers.sql" },
  { name: "20260912_uae_tax_sync_fn_dedupe", path: "supabase/migrations/20260912_uae_tax_sync_fn_dedupe.sql" },
  { name: "20260828_external_form_links", path: "supabase/migrations/20260828_external_form_links.sql" },
  { name: "20260913_goods_master_category", path: "supabase/migrations/20260913_goods_master_category.sql" },
  { name: "20260914_contract_control_center", path: "supabase/migrations/20260914_contract_control_center.sql" },
  { name: "20260915_hr_departments_designations", path: "supabase/migrations/20260915_hr_departments_designations.sql" },
  { name: "20260916_hr_employment_history", path: "supabase/migrations/20260916_hr_employment_history.sql" },
  { name: "20260917_hr_employee_kyc", path: "supabase/migrations/20260917_hr_employee_kyc.sql" },
  { name: "20260918_hr_attendance_leave", path: "supabase/migrations/20260918_hr_attendance_leave.sql" },
  { name: "20260919_hr_payroll_runs", path: "supabase/migrations/20260919_hr_payroll_runs.sql" },
  { name: "20260920_hr_payroll_tax_config", path: "supabase/migrations/20260920_hr_payroll_tax_config.sql" },
  { name: "20260921_hr_smart_crm_reminders", path: "supabase/migrations/20260921_hr_smart_crm_reminders.sql" },
  { name: "20260922_hr_gratuity_settlement", path: "supabase/migrations/20260922_hr_gratuity_settlement.sql" },
  { name: "20260923_hr_country_currency", path: "supabase/migrations/20260923_hr_country_currency.sql" },
  { name: "20260924_hr_onboarding", path: "supabase/migrations/20260924_hr_onboarding.sql" },
  { name: "20260925_document_intelligence_foundation", path: "supabase/migrations/20260925_document_intelligence_foundation.sql" },
  { name: "20260926_document_intake_drafts", path: "supabase/migrations/20260926_document_intake_drafts.sql" },
  { name: "20260927_purchase_loading_batches", path: "supabase/migrations/20260927_purchase_loading_batches.sql" },
  { name: "20260928_business_shipping_handovers", path: "supabase/migrations/20260928_business_shipping_handovers.sql" },
  { name: "20260929_document_intake_roznamcha", path: "supabase/migrations/20260929_document_intake_roznamcha.sql" },
  { name: "20260930_hr_leave_attendance_reconciliation", path: "supabase/migrations/20260930_hr_leave_attendance_reconciliation.sql" },
  { name: "20261001_multicurrency_purchase_payment_fix", path: "supabase/migrations/20261001_multicurrency_purchase_payment_fix.sql" },
  { name: "20261002_goods_variety_and_extra_details", path: "supabase/migrations/20261002_goods_variety_and_extra_details.sql" },
  { name: "20261003_prod_reconcile_rls_hardening", path: "supabase/migrations/20261003_prod_reconcile_rls_hardening.sql" },
  { name: "20261004_prod_reconcile_functions", path: "supabase/migrations/20261004_prod_reconcile_functions.sql" },
  { name: "20261005_prod_reconcile_missing_objects", path: "supabase/migrations/20261005_prod_reconcile_missing_objects.sql" },
  { name: "20261006_almond_kernel_master_parameters", path: "supabase/migrations/20261006_almond_kernel_master_parameters.sql" },
  { name: "20261007_goods_master_parameters_unique_guard", path: "supabase/migrations/20261007_goods_master_parameters_unique_guard.sql" },
  { name: "20261008_cleanup_user_directory_master", path: "supabase/migrations/20261008_cleanup_user_directory_master.sql" },
  { name: "20261009_doc_intake_master_document_types", path: "supabase/migrations/20261009_doc_intake_master_document_types.sql" },
  { name: "20261010_doc_intake_contract_route", path: "supabase/migrations/20261010_doc_intake_contract_route.sql" },
  { name: "20261011_doc_intake_employee_expense_types", path: "supabase/migrations/20261011_doc_intake_employee_expense_types.sql" },
  { name: "20261012_dgt_connect", path: "supabase/migrations/20261012_dgt_connect.sql" },
  { name: "20261013_erp_translation_memory", path: "supabase/migrations/20261013_erp_translation_memory.sql" },
  { name: "20261014_bill_expenses", path: "supabase/migrations/20261014_bill_expenses.sql" },
  { name: "20261015_branch_business_scope", path: "supabase/migrations/20261015_branch_business_scope.sql" },
  { name: "20261016_settlement_sync_schema_fix", path: "supabase/migrations/20261016_settlement_sync_schema_fix.sql" },
  { name: "20261017_bill_expenses_source_delete", path: "supabase/migrations/20261017_bill_expenses_source_delete.sql" },
  { name: "20261018_user_tasks", path: "supabase/migrations/20261018_user_tasks.sql" },
  { name: "20261019_daily_fx_intraday", path: "supabase/migrations/20261019_daily_fx_intraday.sql" },
  { name: "20261020_daily_fx_get_rate_dedupe", path: "supabase/migrations/20261020_daily_fx_get_rate_dedupe.sql" },
  { name: "20261021_customer_inquiries", path: "supabase/migrations/20261021_customer_inquiries.sql" },
  { name: "20261022_translation_consolidation", path: "supabase/migrations/20261022_translation_consolidation.sql" },
  { name: "20261023_business_edit_invoices", path: "supabase/migrations/20261023_business_edit_invoices.sql" },
  { name: "20261024_clearing_order_truck", path: "supabase/migrations/20261024_clearing_order_truck.sql" },
  { name: "20261025_product_reorder_barcode", path: "supabase/migrations/20261025_product_reorder_barcode.sql" },
  { name: "20261026_ai_calls", path: "supabase/migrations/20261026_ai_calls.sql" },
  { name: "20261027_goods_reorder_barcode", path: "supabase/migrations/20261027_goods_reorder_barcode.sql" },
  { name: "20261028_consignment_register", path: "supabase/migrations/20261028_consignment_register.sql" }
];

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

// Migrations that delete/reset real business or user data. These must NEVER run
// automatically (CI / prod auto-deploy). Apply them by hand, per-environment,
// with a verified backup, after explicit owner approval — set
// ALLOW_DESTRUCTIVE_MIGRATIONS=1 for that one manual run.
const DESTRUCTIVE_MANUAL_ONLY = new Set([
  "20261008_cleanup_user_directory_master",
  // Second cleanup variant — soft-deletes all profiles except an 18-user
  // whitelist. Not in the migrations[] list above; listed here as defence in
  // depth so it can never be auto-applied even if someone adds it later.
  "20261008_cleanup_dev_users_directory",
]);
const allowDestructive = process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "1";

try {
  console.log("Connecting to Supabase Database:", env.NEXT_PUBLIC_SUPABASE_URL || "Postgres");
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;

  for (const mig of migrations) {
    const existing = await sql`select name, status from erp_schema_migrations where name = ${mig.name}`;
    if (existing.length && existing[0].status === "applied") {
      console.log(`[SKIP] Migration already applied: ${mig.name}`);
      continue;
    }

    if (DESTRUCTIVE_MANUAL_ONLY.has(mig.name) && !allowDestructive) {
      console.log(`[BLOCKED] ${mig.name} is destructive (deletes user/business data) — skipped. Run manually with ALLOW_DESTRUCTIVE_MIGRATIONS=1 after a backup.`);
      continue;
    }

    console.log(`[APPLYING] Migration ${mig.name}...`);
    const migrationSql = fs.readFileSync(mig.path, "utf8");
    await sql.unsafe(migrationSql);
    await sql`insert into erp_schema_migrations (name, status) values (${mig.name}, 'applied') on conflict (name) do update set status='applied', applied_at=now()`;
    console.log(`[SUCCESS] Migration applied: ${mig.name}`);
  }

  // Verification checks
  const colCheck = await sql`
    select column_name from information_schema.columns 
    where table_name = 'roznamcha_entries' and column_name = 'entry_category'
  `;

  const perLangCheck = await sql`
    select relname from pg_class where relname = 'translations_english' and relnamespace = 'public'::regnamespace
  `;

  console.log(JSON.stringify({
    ok: true,
    entry_category_column_exists: colCheck.length > 0,
    per_language_tables_exist: perLangCheck.length > 0
  }, null, 2));

} catch (error) {
  console.error("MIGRATION FAILED:", error.message);
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
