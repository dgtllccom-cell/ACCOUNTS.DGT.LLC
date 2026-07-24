import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-clean-operational";
const applyChanges = process.argv.includes(confirmFlag);

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
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function tableExists(table) {
  const [row] = await sql`select to_regclass(${`public.${table}`}) as table_name`;
  return Boolean(row?.table_name);
}

async function countRows(table) {
  if (!(await tableExists(table))) return null;
  const [row] = await sql.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  return row.count;
}

async function deleteRows(table) {
  if (!(await tableExists(table))) {
    return { table, status: "skipped_missing", before: null, after: null };
  }
  const before = await countRows(table);
  if (applyChanges) {
    await sql.unsafe(`delete from public.${quoteIdent(table)}`);
  }
  const after = await countRows(table);
  return { table, status: applyChanges ? "deleted" : "dry_run", before, after };
}

const preservedTables = [
  "profiles",
  "user_role_assignments",
  "countries",
  "states_provinces",
  "cities",
  "areas_locations",
  "country_branches",
  "city_branches",
  "companies",
  "enterprise_accounts",
  "ledgers",
  "payment_methods",
  "currency_rates"
];

// Child/detail tables first, parent/header tables later. Master tables are intentionally excluded.
const operationalDeleteOrder = [
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
  "transaction_serial_sequences"
];

const auditEntityTables = [
  "expenses_bills",
  "expenses_bill_lines",
  "purchase_orders",
  "purchase_order_expenses",
  "purchase_order_items",
  "purchase_order_reports",
  "purchase_order_payments",
  "purchase_loading_records",
  "sales_orders",
  "sales_order_payments",
  "shipping_line_records",
  "shipping_bl_records",
  "shipment_documents",
  "roznamcha_entries",
  "roznamcha_lines",
  "journal_entries",
  "journal_lines",
  "ledger_posting_batches",
  "ledger_posting_lines",
  "ledger_balances",
  "transactions"
];

async function snapshot(tables) {
  const counts = {};
  for (const table of tables) counts[table] = await countRows(table);
  return counts;
}

try {
  const preservedBefore = await snapshot(preservedTables);
  const operationalBefore = await snapshot(operationalDeleteOrder);
  const historyBefore = await sql`
    select event_type, count(*)::int as count
    from public.enterprise_account_history
    group by event_type
    order by event_type
  `.catch(() => []);

  const results = [];
  if (applyChanges) {
    await sql.begin(async (tx) => {
      for (const table of operationalDeleteOrder) {
        const [exists] = await tx`select to_regclass(${`public.${table}`}) as table_name`;
        if (!exists?.table_name) {
          results.push({ table, status: "skipped_missing", before: operationalBefore[table], after: null });
          continue;
        }
        await tx.unsafe(`delete from public.${quoteIdent(table)}`);
        const [after] = await tx.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
        results.push({ table, status: "deleted", before: operationalBefore[table], after: after.count });
      }

      const [historyExists] = await tx`select to_regclass('public.enterprise_account_history') as table_name`;
      if (historyExists?.table_name) {
        await tx`
          delete from public.enterprise_account_history
          where event_type <> 'created'
        `;
      }

      const [accountsExist] = await tx`select to_regclass('public.enterprise_accounts') as table_name`;
      if (accountsExist?.table_name) {
        await tx`
          update public.enterprise_accounts
          set current_balance = coalesce(opening_balance, 0),
              updated_at = now()
          where deleted_at is null
        `;
      }

      const [ledgersExist] = await tx`select to_regclass('public.ledgers') as table_name`;
      if (ledgersExist?.table_name) {
        await tx`
          update public.ledgers
          set current_balance = coalesce(opening_balance, 0),
              debit_total = 0,
              credit_total = 0,
              updated_at = now()
          where deleted_at is null
        `;
      }

      const [auditExists] = await tx`select to_regclass('public.audit_logs') as table_name`;
      if (auditExists?.table_name) {
        await tx`
          delete from public.audit_logs
          where entity_table in ${tx(auditEntityTables)}
        `;
      }
    });
  } else {
    for (const table of operationalDeleteOrder) results.push(await deleteRows(table));
  }

  const preservedAfter = await snapshot(preservedTables);
  const operationalAfter = await snapshot(operationalDeleteOrder);
  const historyAfter = await sql`
    select event_type, count(*)::int as count
    from public.enterprise_account_history
    group by event_type
    order by event_type
  `.catch(() => []);

  console.log(
    JSON.stringify(
      {
        status: applyChanges ? "success" : "dry_run",
        mode: applyChanges ? "applied" : `no changes; rerun with ${confirmFlag}`,
        preservedBefore,
        preservedAfter,
        operationalBefore,
        operationalAfter,
        enterpriseAccountHistoryBefore: historyBefore,
        enterpriseAccountHistoryAfter: historyAfter,
        results
      },
      null,
      2
    )
  );
} finally {
  await sql.end();
}
