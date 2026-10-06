import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-fresh-erp-transactions";
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
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "")];
    })
);

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env.local");
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

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
  "erp_migration_history"
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
  "enterprise_account_history",
  "ledgers",
  "accounts",
  "enterprise_accounts"
];

const translationRecordTables = [
  "enterprise_accounts",
  "accounts",
  "ledgers",
  "purchase_orders",
  "purchase_order_payments",
  "purchase_loading_records",
  "roznamcha_entries",
  "roznamcha_lines",
  "journal_entries",
  "journal_lines",
  "ledger_entries",
  "ledger_posting_lines",
  "sales_orders",
  "sales_order_payments",
  "shipping_line_records",
  "shipping_bl_records",
  "expenses_bills",
  "transactions"
];

const auditEntityTables = translationRecordTables.concat([
  "ledger_balances",
  "ledger_posting_batches",
  "enterprise_account_history",
  "approval_requests",
  "voucher_sequences"
]);

async function snapshot(tables) {
  const counts = {};
  for (const table of tables) counts[table] = await countRows(sql, table);
  return counts;
}

try {
  const preservedBefore = await snapshot(preservedTables);
  const before = await snapshot(deleteOrder);
  const recordTranslationsBefore = await countRows(sql, "record_translations");
  const auditBefore = await countRows(sql, "audit_logs");
  const results = [];

  await sql.begin(async (tx) => {
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
        results.push({ table, status: "skipped_missing", before: before[table], after: null });
        continue;
      }
      await tx.unsafe(`delete from public.${quoteIdent(table)}`);
      const [after] = await tx.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
      results.push({ table, status: "deleted", before: before[table], after: after.count });
    }
  });

  const preservedAfter = await snapshot(preservedTables);
  const after = await snapshot(deleteOrder);
  const recordTranslationsAfter = await countRows(sql, "record_translations");
  const auditAfter = await countRows(sql, "audit_logs");

  console.log(JSON.stringify({
    status: "success",
    preservedBefore,
    preservedAfter,
    deletedBefore: before,
    deletedAfter: after,
    recordTranslationsBefore,
    recordTranslationsAfter,
    auditBefore,
    auditAfter,
    results
  }, null, 2));
} catch (error) {
  console.error("FRESH_ERP_TRANSACTION_CLEANUP_FAILED", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}