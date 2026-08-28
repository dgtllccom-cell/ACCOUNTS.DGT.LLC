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
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env or .env.local");
  process.exit(1);
}

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
  { name: "20260923_hr_country_currency", path: "supabase/migrations/20260923_hr_country_currency.sql" }
];

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  console.log("Connecting to Supabase Database:", env.NEXT_PUBLIC_SUPABASE_URL || "Postgres");
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;

  for (const mig of migrations) {
    const existing = await sql`select name, status from erp_schema_migrations where name = ${mig.name}`;
    if (existing.length && existing[0].status === "applied") {
      console.log(`[SKIP] Migration already applied: ${mig.name}`);
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
