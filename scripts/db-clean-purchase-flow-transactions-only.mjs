import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-clean-purchase-flow";
const applyChanges = process.argv.includes(confirmFlag);

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 5
});

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function tableExists(tx, table) {
  const [row] = await tx`select to_regclass(${`public.${table}`}) as table_name`;
  return Boolean(row?.table_name);
}

async function columnsFor(table) {
  const rows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
  `;
  return new Set(rows.map((row) => row.column_name));
}

async function countRows(table) {
  if (!(await tableExists(sql, table))) return null;
  const [row] = await sql.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  return row.count;
}

async function deleteAll(tx, table) {
  if (!(await tableExists(tx, table))) return { table, before: null, after: null, deleted: 0, status: "missing" };
  const [before] = await tx.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  if (applyChanges) {
    await tx.unsafe(`delete from public.${quoteIdent(table)}`);
  }
  const [after] = await tx.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  return { table, before: before.count, after: after.count, deleted: before.count - after.count, status: applyChanges ? "deleted" : "dry_run" };
}

async function resetAccountBalances(tx) {
  const results = [];
  if (await tableExists(tx, "enterprise_accounts")) {
    if (applyChanges) {
      await tx`
        update public.enterprise_accounts
        set current_balance = coalesce(opening_balance, 0),
            updated_at = now()
        where deleted_at is null
      `;
    }
    results.push("enterprise_accounts.current_balance reset to opening_balance");
  }
  if (await tableExists(tx, "ledgers")) {
    if (applyChanges) {
      await tx`
        update public.ledgers
        set current_balance = coalesce(opening_balance, 0),
            debit_total = 0,
            credit_total = 0,
            updated_at = now()
        where deleted_at is null
      `;
    }
    results.push("ledgers debit/credit/current balances reset");
  }
  return results;
}

async function resetPurchaseFlowSerials(tx) {
  if (!(await tableExists(tx, "transaction_serial_sequences"))) {
    return { status: "missing", before: null, after: null, deleted: 0 };
  }

  const beforeRows = await tx`
    select scope_type, scope_key, entity_type, prefix, next_value
    from public.transaction_serial_sequences
    where coalesce(entity_type, 'roznamcha') in ('purchase', 'loading', 'payment', 'journal', 'roznamcha')
       or scope_type in ('module_purchase', 'module_loading', 'module_payment', 'module_roznamcha')
    order by scope_type, scope_key, entity_type
  `;

  if (applyChanges) {
    await tx`
      delete from public.transaction_serial_sequences
      where coalesce(entity_type, 'roznamcha') in ('purchase', 'loading', 'payment', 'journal', 'roznamcha')
         or scope_type in ('module_purchase', 'module_loading', 'module_payment', 'module_roznamcha')
    `;
  }

  const afterRows = await tx`
    select scope_type, scope_key, entity_type, prefix, next_value
    from public.transaction_serial_sequences
    where coalesce(entity_type, 'roznamcha') in ('purchase', 'loading', 'payment', 'journal', 'roznamcha')
       or scope_type in ('module_purchase', 'module_loading', 'module_payment', 'module_roznamcha')
    order by scope_type, scope_key, entity_type
  `;

  return {
    status: applyChanges ? "reset" : "dry_run",
    before: beforeRows.length,
    after: afterRows.length,
    deleted: beforeRows.length - afterRows.length,
    preview: beforeRows.slice(0, 20)
  };
}

const purchaseTablesDeleteOrder = [
  "purchase_loading_records",
  "purchase_order_payments",
  "purchase_order_expenses",
  "purchase_order_items",
  "purchase_order_reports",
  "purchase_orders"
];

const accountingTablesDeleteOrder = [
  "ledger_transaction_audit_trail",
  "inter_branch_ledger_transfers",
  "ledger_entries",
  "journal_lines",
  "journal_entries",
  "ledger_posting_lines",
  "ledger_posting_batches",
  "ledger_balances",
  "roznamcha_lines",
  "roznamcha_entries",
  "cash_transactions",
  "transactions"
];

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

try {
  const before = {};
  for (const table of [...purchaseTablesDeleteOrder, ...accountingTablesDeleteOrder, "transaction_serial_sequences"]) {
    before[table] = await countRows(table);
  }
  const preservedBefore = {};
  for (const table of preservedTables) preservedBefore[table] = await countRows(table);

  const results = await sql.begin(async (tx) => {
    const deletes = [];
    for (const table of purchaseTablesDeleteOrder) {
      deletes.push(await deleteAll(tx, table));
    }
    for (const table of accountingTablesDeleteOrder) {
      deletes.push(await deleteAll(tx, table));
    }

    if (await tableExists(tx, "enterprise_account_history")) {
      const cols = await columnsFor("enterprise_account_history");
      if (cols.has("event_type")) {
        const [beforeHistory] = await tx`select count(*)::int as count from public.enterprise_account_history where event_type <> 'created'`;
        if (applyChanges) {
          await tx`delete from public.enterprise_account_history where event_type <> 'created'`;
        }
        const [afterHistory] = await tx`select count(*)::int as count from public.enterprise_account_history where event_type <> 'created'`;
        deletes.push({
          table: "enterprise_account_history(non-created)",
          before: beforeHistory.count,
          after: afterHistory.count,
          deleted: beforeHistory.count - afterHistory.count,
          status: applyChanges ? "deleted" : "dry_run"
        });
      }
    }

    if (await tableExists(tx, "audit_logs")) {
      const [beforeAudit] = await tx`
        select count(*)::int as count
        from public.audit_logs
        where entity_table in ${tx([...purchaseTablesDeleteOrder, ...accountingTablesDeleteOrder])}
      `;
      if (applyChanges) {
        await tx`
          delete from public.audit_logs
          where entity_table in ${tx([...purchaseTablesDeleteOrder, ...accountingTablesDeleteOrder])}
        `;
      }
      const [afterAudit] = await tx`
        select count(*)::int as count
        from public.audit_logs
        where entity_table in ${tx([...purchaseTablesDeleteOrder, ...accountingTablesDeleteOrder])}
      `;
      deletes.push({
        table: "audit_logs(purchase/accounting entities)",
        before: beforeAudit.count,
        after: afterAudit.count,
        deleted: beforeAudit.count - afterAudit.count,
        status: applyChanges ? "deleted" : "dry_run"
      });
    }

    const balanceReset = await resetAccountBalances(tx);
    const serialReset = await resetPurchaseFlowSerials(tx);
    return { deletes, balanceReset, serialReset };
  });

  const after = {};
  for (const table of [...purchaseTablesDeleteOrder, ...accountingTablesDeleteOrder, "transaction_serial_sequences"]) {
    after[table] = await countRows(table);
  }
  const preservedAfter = {};
  for (const table of preservedTables) preservedAfter[table] = await countRows(table);

  const preservedChanged = Object.fromEntries(
    Object.keys(preservedBefore)
      .filter((table) => preservedBefore[table] !== preservedAfter[table])
      .map((table) => [table, { before: preservedBefore[table], after: preservedAfter[table] }])
  );

  console.log(JSON.stringify({
    status: applyChanges ? "success" : "dry_run",
    mode: applyChanges ? "applied" : `No rows deleted. Rerun with ${confirmFlag}`,
    before,
    after,
    preservedBefore,
    preservedAfter,
    preservedChanged,
    results
  }, null, 2));
} finally {
  await sql.end();
}
