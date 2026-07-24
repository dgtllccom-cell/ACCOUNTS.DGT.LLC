import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-accounting-reset";
if (!process.argv.includes(confirmFlag)) {
  console.error(`Refusing to reset accounting data without ${confirmFlag}`);
  process.exit(1);
}

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

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function tableExists(table) {
  const [row] = await sql`
    select to_regclass(${`public.${table}`}) as table_name
  `;
  return Boolean(row?.table_name);
}

async function countRows(table) {
  if (!(await tableExists(table))) return null;
  const [row] = await sql.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
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
  "translation_values"
];

const accountingDeleteOrder = [
  "ledger_transaction_audit_trail",
  "inter_branch_ledger_transfers",
  "purchase_order_payments",
  "sales_order_payments",
  "sales_orders",
  "shipping_bl_records",
  "shipping_line_records",
  "roznamcha_reversals",
  "transactions",
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
  "enterprise_account_history",
  "ledgers",
  "accounts",
  "enterprise_accounts",
  "voucher_sequences",
  "approval_status_history",
  "approval_request_items",
  "approval_requests"
];

const preservedCountsBefore = {};
for (const table of preservedTables) {
  preservedCountsBefore[table] = await countRows(table);
}

const resetResults = [];
try {
  const resetCountsBefore = {};
  const existingResetTables = [];
  for (const table of accountingDeleteOrder) {
    const exists = await tableExists(table);
    resetCountsBefore[table] = exists ? await countRows(table) : null;
    if (exists) existingResetTables.push(table);
  }

  await sql.begin(async () => {
    if (existingResetTables.length) {
      await sql.unsafe(
        `truncate table ${existingResetTables.map((table) => `public.${quoteIdent(table)}`).join(", ")} restart identity cascade`
      );
    }
  });

  const preservedCountsAfter = {};
  for (const table of preservedTables) {
    preservedCountsAfter[table] = await countRows(table);
  }

  const resetCountsAfter = {};
  for (const table of accountingDeleteOrder) {
    resetCountsAfter[table] = await countRows(table);
    resetResults.push({
      table,
      status: resetCountsBefore[table] === null ? "skipped" : "truncated",
      before: resetCountsBefore[table],
      after: resetCountsAfter[table]
    });
  }

  console.log(
    JSON.stringify(
      {
        status: "success",
        preservedCountsBefore,
        preservedCountsAfter,
        resetResults,
        resetCountsAfter
      },
      null,
      2
    )
  );
} finally {
  await sql.end();
}
