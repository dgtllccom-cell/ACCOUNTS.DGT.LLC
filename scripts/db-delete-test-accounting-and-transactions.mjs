import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const confirmFlag = "--confirm-delete-test-accounting-data";
if (!process.argv.includes(confirmFlag)) {
  console.error(`Refusing to delete data without ${confirmFlag}`);
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^[\'"]|[\'"]$/g, "")];
    })
);

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env.local");

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20, idle_timeout: 20 });

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function tableExists(db, table) {
  const [row] = await db`select to_regclass(${`public.${table}`}) as table_name`;
  return Boolean(row?.table_name);
}

async function countRows(db, table) {
  if (!(await tableExists(db, table))) return null;
  const [row] = await db.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  return row.count;
}

const preservedTables = [
  "profiles",
  "user_role_assignments",
  "roles",
  "permissions",
  "role_permissions",
  "countries",
  "states_provinces",
  "cities",
  "areas_locations",
  "country_branches",
  "city_branches",
  "companies",
  "languages",
  "translation_keys",
  "translation_values",
  "erp_schema_migrations",
  "erp_migration_history",
  "erp_email_accounts",
  "whatsapp_accounts",
  "payment_methods",
  "account_groups",
  "account_types"
];

const deleteOrder = [
  "shipment_documents",
  "shipping_bl_records",
  "shipping_line_records",
  "expenses_bill_lines",
  "expenses_bills",
  "purchase_loading_records",
  "purchase_order_expenses",
  "purchase_order_items",
  "purchase_order_reports",
  "purchase_order_payments",
  "purchase_orders",
  "local_purchases",
  "sales_order_payments",
  "sales_orders",
  "roznamcha_reversals",
  "journal_reversals",
  "ledger_transaction_audit_trail",
  "inter_branch_ledger_transfers",
  "ledger_entries",
  "journal_lines",
  "journal_entries",
  "ledger_balances",
  "ledger_posting_lines",
  "roznamcha_lines",
  "roznamcha_entries",
  "enterprise_ledger_reversals",
  "ledger_opening_balances",
  "ledger_posting_batches",
  "cash_transactions",
  "transactions",
  "usd_purchase_sales",
  "approval_status_history",
  "approval_request_items",
  "approval_requests",
  "voucher_sequences",
  "transaction_serial_sequences",
  "module_number_sequences",
  "report_exports",
  "report_runs",
  "report_snapshots",
  "reports",
  "erp_report_exports",
  "enterprise_account_history",
  "ledgers",
  "accounts",
  "enterprise_accounts",
  "product_warehouse_mapping",
  "product_branch_mapping",
  "product_city_mapping",
  "product_country_mapping",
  "product_inventory_balances",
  "product_translations",
  "product_brands",
  "product_categories",
  "product_units",
  "products",
  "goods_variations",
  "goods"
];

const translationRecordTables = [
  "enterprise_accounts",
  "accounts",
  "ledgers",
  "goods",
  "goods_variations",
  "products",
  "product_brands",
  "product_categories",
  "product_units",
  "purchase_orders",
  "purchase_order_items",
  "purchase_order_payments",
  "purchase_loading_records",
  "local_purchases",
  "sales_orders",
  "sales_order_payments",
  "shipping_line_records",
  "shipping_bl_records",
  "shipment_documents",
  "expenses_bills",
  "roznamcha_entries",
  "roznamcha_lines",
  "journal_entries",
  "journal_lines",
  "ledger_entries",
  "ledger_posting_lines",
  "transactions",
  "reports",
  "report_runs",
  "report_snapshots"
];

const auditEntityTables = [...new Set([...translationRecordTables, "ledger_balances", "ledger_posting_batches", "enterprise_account_history", "approval_requests", "voucher_sequences", "transaction_serial_sequences", "module_number_sequences"] )];

async function snapshot(db, tables) {
  const counts = {};
  for (const table of tables) counts[table] = await countRows(db, table);
  return counts;
}

async function dumpTables(tables, meta) {
  const backupDir = path.join(process.cwd(), ".codex-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(backupDir, `accounting-reset-backup-${stamp}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const manifest = { ...meta, outputDir, createdAt: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    if (!(await tableExists(sql, table))) {
      manifest.tables[table] = { count: null, file: null, status: "skipped_missing" };
      continue;
    }
    const rows = await sql.unsafe(`select * from public.${quoteIdent(table)}`);
    const file = `${table}.json`;
    fs.writeFileSync(path.join(outputDir, file), JSON.stringify(rows, null, 2), "utf8");
    manifest.tables[table] = { count: rows.length, file, status: "backed_up" };
  }

  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return outputDir;
}

try {
  await sql`set statement_timeout = 0`.catch(() => []);
  const backupTables = [...new Set([...preservedTables, ...deleteOrder, "record_translations", "record_translation_events", "audit_logs"] )];
  const preservedBefore = await snapshot(sql, preservedTables);
  const deleteBefore = await snapshot(sql, deleteOrder);
  const backupDir = await dumpTables(backupTables, { reason: "Delete all test accounting and transaction data; preserve setup/branches/users/settings" });

  const results = [];
  await sql.begin(async (tx) => {
    await tx`set statement_timeout = 0`.catch(() => []);

    if (await tableExists(tx, "record_translation_events")) {
      await tx`delete from public.record_translation_events where record_translation_id in (select id from public.record_translations where record_table in ${tx(translationRecordTables)})`;
    }

    if (await tableExists(tx, "record_translations")) {
      await tx`delete from public.record_translations where record_table in ${tx(translationRecordTables)}`;
    }

    if (await tableExists(tx, "audit_logs")) {
      await tx`delete from public.audit_logs where entity_table in ${tx(auditEntityTables)}`;
    }

    for (const table of deleteOrder) {
      if (!(await tableExists(tx, table))) {
        results.push({ table, status: "skipped_missing", before: deleteBefore[table], after: null });
        continue;
      }
      await tx.unsafe(`delete from public.${quoteIdent(table)}`);
      const [after] = await tx.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
      results.push({ table, status: "deleted", before: deleteBefore[table], after: after.count });
    }
  });

  const preservedAfter = await snapshot(sql, preservedTables);
  const deleteAfter = await snapshot(sql, deleteOrder);
  const nonZeroDeletedTables = Object.entries(deleteAfter).filter(([, count]) => count && count > 0);
  const preservedChanged = Object.fromEntries(
    Object.entries(preservedBefore).filter(([table, before]) => preservedAfter[table] !== before)
  );

  console.log(JSON.stringify({
    status: "success",
    backupDir,
    preservedBefore,
    preservedAfter,
    preservedChanged,
    deleteBefore,
    deleteAfter,
    nonZeroDeletedTables,
    results
  }, null, 2));
} catch (error) {
  console.error("DELETE_TEST_ACCOUNTING_DATA_FAILED", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
