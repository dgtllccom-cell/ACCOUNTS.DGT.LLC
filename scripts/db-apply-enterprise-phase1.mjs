import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15
});

const migrations = [
  {
    name: "0001_foundation",
    path: "supabase/migrations/0001_foundation.sql",
    sentinels: ["companies", "profiles", "permissions", "journal_entries", "ledger_entries"]
  },
  {
    name: "0002_multi_country_branch_management",
    path: "supabase/migrations/0002_multi_country_branch_management.sql",
    sentinels: [
      "countries",
      "country_branches",
      "city_branches",
      "user_role_assignments",
      "currency_rates",
      "transactions",
      "reports"
    ]
  },
  {
    name: "0003_enterprise_erp_phase_1",
    path: "supabase/migrations/0003_enterprise_erp_phase_1.sql",
    sentinels: [
      "languages",
      "approval_requests",
      "ledgers",
      "roznamcha_entries",
      "management_categories",
      "report_definitions",
      "erp_modules"
    ]
  },
  {
    name: "0004_enterprise_role_alignment",
    path: "supabase/migrations/0004_enterprise_role_alignment.sql",
    sentinels: []
  },
  {
    name: "0005_enterprise_api_runtime",
    path: "supabase/migrations/0005_enterprise_api_runtime.sql",
    sentinels: ["ledger_posting_batches", "ledger_posting_lines"]
  },
  {
    name: "0006_enterprise_accounting_alignment",
    path: "supabase/migrations/0006_enterprise_accounting_alignment.sql",
    sentinels: ["enterprise_accounts", "financial_periods", "ledger_opening_balances", "enterprise_ledger_reversals"]
  },
  {
    name: "0007_customers_master_data",
    path: "supabase/migrations/0007_customers_master_data.sql",
    sentinels: ["customers", "customer_contacts", "customer_registrations"]
  },
  {
    name: "0008_branch_location_hierarchy",
    path: "supabase/migrations/0008_branch_location_hierarchy.sql",
    sentinels: []
  },
  {
    name: "0009_user_role_scope_constraint",
    path: "supabase/migrations/0009_user_role_scope_constraint.sql",
    sentinels: []
  },
  {
    name: "0010_branch_form_metadata",
    path: "supabase/migrations/0010_branch_form_metadata.sql",
    sentinels: []
  },
  {
    name: "0011_user_identity_and_permissions",
    path: "supabase/migrations/0011_user_identity_and_permissions.sql",
    sentinels: ["user_permission_sets"]
  },
  {
    name: "0012_fix_post_roznamcha_entry_ambiguous_totals",
    path: "supabase/migrations/0012_fix_post_roznamcha_entry_ambiguous_totals.sql",
    sentinels: []
  },
  {
    name: "0013_contact_type_master_data",
    path: "supabase/migrations/0013_contact_type_master_data.sql",
    sentinels: ["contact_types", "country_contact_type_rules"]
  },
  {
    name: "0014_purchase_orders_and_payments",
    path: "supabase/migrations/0014_purchase_orders_and_payments.sql",
    sentinels: ["purchase_orders", "purchase_order_payments"]
  },
  {
    name: "0015_purchase_order_posting_status",
    path: "supabase/migrations/0015_purchase_order_posting_status.sql",
    sentinels: []
  },
  {
    name: "0016_goods_master_data",
    path: "supabase/migrations/0016_goods_master_data.sql",
    sentinels: ["goods"]
  },
  {
    name: "0017_shipping_bl_records",
    path: "supabase/migrations/0017_shipping_bl_records.sql",
    sentinels: ["shipping_bl_records"]
  },
  {
    name: "0018_rbac_workflow_architecture",
    path: "supabase/migrations/0018_rbac_workflow_architecture.sql",
    sentinels: [
      "clearing_agents",
      "clearing_agent_branches",
      "erp_assignments",
      "erp_record_transfers",
      "erp_activity_events",
      "erp_pdf_email_jobs"
    ]
  },
  {
    name: "0019_multi_company_branding",
    path: "supabase/migrations/0019_multi_company_branding.sql",
    sentinels: ["parent_business_groups", "country_company_profiles"]
  },
  {
    name: "0020_branch_ledger_inter_branch_accounting",
    path: "supabase/migrations/0020_branch_ledger_inter_branch_accounting.sql",
    sentinels: ["inter_branch_ledger_transfers", "ledger_transaction_audit_trail"]
  },
  {
    name: "0021_branch_permission_grants",
    path: "supabase/migrations/0021_branch_permission_grants.sql",
    sentinels: []
  },
  {
    name: "0022_multilingual_search_enforcement",
    path: "supabase/migrations/0022_multilingual_search_enforcement.sql",
    sentinels: []
  },
  {
    name: "0023_product_master_architecture",
    path: "supabase/migrations/0023_product_master_architecture.sql",
    sentinels: [
      "product_categories",
      "product_brands",
      "product_units",
      "products",
      "product_translations",
      "product_country_mapping",
      "product_city_mapping",
      "product_branch_mapping",
      "product_warehouse_mapping",
      "product_inventory_balances"
    ]
  },
  {
    name: "0024_purchase_loading_records",
    path: "supabase/migrations/0024_purchase_loading_records.sql",
    sentinels: ["purchase_loading_records"]
  },
  {
    name: "0025_account_identity_history",
    path: "supabase/migrations/0025_account_identity_history.sql",
    sentinels: ["enterprise_account_history"]
  },
  {
    name: "0026_account_master_references",
    path: "supabase/migrations/0026_account_master_references.sql",
    sentinels: ["enterprise_accounts_manual_reference_number_idx"]
  },
  {
    name: "0027_transaction_identity_traceability",
    path: "supabase/migrations/0027_transaction_identity_traceability.sql",
    sentinels: ["ledger_posting_lines_identity_traceability_idx", "roznamcha_lines_identity_traceability_idx"]
  },
  {
    name: "0028_core_module_database_completion",
    path: "supabase/migrations/0028_core_module_database_completion.sql",
    sentinels: ["sales_orders", "sales_order_payments", "shipping_line_records", "shipment_documents", "erp_page_database_bindings"]
  },
  {
    name: "0029_roznamcha_transaction_serials",
    path: "supabase/migrations/0029_roznamcha_transaction_serials.sql",
    sentinels: ["transaction_serial_sequences", "roznamcha_entries_super_admin_serial_idx", "roznamcha_lines_transaction_serials_idx"]
  },
  {
    name: "0030_allow_main_branch_roznamcha_scope",
    path: "supabase/migrations/0030_allow_main_branch_roznamcha_scope.sql",
    sentinels: []
  }
];

async function tableExists(tableName) {
  const [row] = await sql`
    select to_regclass(${`public.${tableName}`}) as table_name
  `;
  return Boolean(row.table_name);
}

async function sentinelState(sentinels) {
  const states = await Promise.all(sentinels.map(async (table) => [table, await tableExists(table)]));
  return Object.fromEntries(states);
}

async function migrationApplied(name) {
  const [row] = await sql`
    select exists (
      select 1
      from erp_schema_migrations
      where name = ${name}
    ) as applied
  `;
  return row.applied;
}

async function markMigration(name, status) {
  await sql`
    insert into erp_schema_migrations (name, status)
    values (${name}, ${status})
    on conflict (name) do update
      set status = excluded.status,
          applied_at = now()
  `;
}

async function applyMigration(migration) {
  const applied = await migrationApplied(migration.name);
  if (!migration.sentinels.length) {
    if (applied) {
      console.log(`${migration.name}: already marked applied`);
      return;
    }

    const sqlText = fs.readFileSync(migration.path, "utf8");
    await sql.unsafe(sqlText);
    await markMigration(migration.name, "applied");
    console.log(`${migration.name}: applied`);
    return;
  }

  const state = await sentinelState(migration.sentinels);
  const existing = Object.values(state).filter(Boolean).length;

  if (applied) {
    console.log(`${migration.name}: already marked applied`);
    return;
  }

  if (existing === migration.sentinels.length) {
    await markMigration(migration.name, "verified_existing");
    console.log(`${migration.name}: schema already present, marker recorded`);
    return;
  }

  if (existing > 0) {
    console.error(`${migration.name}: partial schema detected, aborting for safety`);
    console.error(JSON.stringify(state, null, 2));
    process.exit(1);
  }

  const sqlText = fs.readFileSync(migration.path, "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(sqlText);
    await tx`
      insert into erp_schema_migrations (name, status)
      values (${migration.name}, 'applied')
      on conflict (name) do update
        set status = excluded.status,
            applied_at = now()
    `;
  });
  console.log(`${migration.name}: applied`);
}

async function applySeed() {
  const seedPath = "supabase/seed_phase_1.sql";
  const seedSql = fs.readFileSync(seedPath, "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(seedSql);
  });
  console.log("seed_phase_1: applied");
}

async function verify() {
  const requiredTables = [
    "countries",
    "country_branches",
    "city_branches",
    "languages",
    "record_translations",
    "approval_requests",
    "record_locks",
    "ledgers",
    "ledger_balances",
    "ledger_posting_batches",
    "ledger_posting_lines",
    "enterprise_accounts",
    "financial_periods",
    "ledger_opening_balances",
    "enterprise_ledger_reversals",
    "roznamcha_entries",
    "roznamcha_lines",
      "daily_usd_rates",
      "customers",
      "customer_contacts",
      "customer_registrations",
      "management_categories",
      "management_parameters",
      "report_definitions",
      "erp_modules",
      "purchase_orders",
      "purchase_order_payments",
      "shipping_bl_records",
      "clearing_agents",
      "clearing_agent_branches",
      "erp_assignments",
      "erp_record_transfers",
      "erp_activity_events",
      "erp_pdf_email_jobs",
      "parent_business_groups",
      "country_company_profiles",
      "inter_branch_ledger_transfers",
      "ledger_transaction_audit_trail",
      "product_categories",
      "product_brands",
      "product_units",
      "products",
      "product_translations",
      "product_country_mapping",
      "product_city_mapping",
      "product_branch_mapping",
      "product_warehouse_mapping",
      "product_inventory_balances",
      "purchase_loading_records",
      "enterprise_account_history"
    ];

  const tableRows = await Promise.all(
    requiredTables.map(async (table) => ({ table, exists: await tableExists(table) }))
  );
  const missing = tableRows.filter((row) => !row.exists);

  const [languageCount] = await sql`select count(*)::int as count from languages`;
  const [countryCount] = await sql`select count(*)::int as count from countries where deleted_at is null`;
  const [moduleCount] = await sql`select count(*)::int as count from erp_modules where deleted_at is null`;
  const [roleTemplateCount] = await sql`select count(*)::int as count from erp_role_templates where deleted_at is null`;
  const [managementParameterCount] =
    await sql`select count(*)::int as count from management_parameters where deleted_at is null`;

  console.log(
    JSON.stringify(
      {
        missingTables: missing,
        languages: languageCount.count,
        countries: countryCount.count,
        erpModules: moduleCount.count,
        roleTemplates: roleTemplateCount.count,
        managementParameters: managementParameterCount.count
      },
      null,
      2
    )
  );

  if (missing.length) {
    process.exit(1);
  }
}

try {
  await sql`select now()`;
  await sql`
    create table if not exists erp_schema_migrations (
      name text primary key,
      status text not null,
      applied_at timestamptz not null default now()
    )
  `;

  for (const migration of migrations) {
    await applyMigration(migration);
  }

  await applySeed();
  await verify();
} catch (error) {
  console.error("enterprise phase 1 migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
