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
  "ledgers"
];

const operationalTables = [
  "purchase_loading_records",
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
  "ledger_posting_batches",
  "transactions",
  "usd_purchase_sales",
  "transaction_serial_sequences"
];

try {
  const preservedCounts = {};
  const operationalCounts = {};
  for (const table of preservedTables) preservedCounts[table] = await countRows(table);
  for (const table of operationalTables) operationalCounts[table] = await countRows(table);

  const [countryBranchLinks] = await sql`
    select count(*)::int as broken_count
    from public.country_branches cb
    where cb.deleted_at is null
      and (
        cb.country_id is null
        or not exists (
          select 1 from public.countries c
          where c.id = cb.country_id and c.deleted_at is null
        )
      )
  `;

  const [cityBranchLinks] = await sql`
    select count(*)::int as broken_count
    from public.city_branches city
    where city.deleted_at is null
      and (
        city.country_id is null
        or city.country_branch_id is null
        or not exists (
          select 1 from public.countries c
          where c.id = city.country_id and c.deleted_at is null
        )
        or not exists (
          select 1 from public.country_branches cb
          where cb.id = city.country_branch_id and cb.deleted_at is null
        )
      )
  `;

  const [ledgerReset] = await sql`
    select count(*)::int as non_zero_count
    from public.ledgers
    where deleted_at is null
      and (
        coalesce(debit_total, 0) <> 0
        or coalesce(credit_total, 0) <> 0
        or coalesce(current_balance, 0) <> coalesce(opening_balance, 0)
      )
  `;

  const [accountReset] = await sql`
    select count(*)::int as non_reset_count
    from public.enterprise_accounts
    where deleted_at is null
      and coalesce(current_balance, 0) <> coalesce(opening_balance, 0)
  `;

  const historyRows = await sql`
    select event_type, count(*)::int as count
    from public.enterprise_account_history
    group by event_type
    order by event_type
  `.catch(() => []);

  const branchPreview = await sql`
    select
      c.name as country,
      cb.name as main_branch,
      cb.code as main_branch_code,
      count(city.id)::int as city_branches
    from public.country_branches cb
    join public.countries c on c.id = cb.country_id
    left join public.city_branches city on city.country_branch_id = cb.id and city.deleted_at is null
    where cb.deleted_at is null and c.deleted_at is null
    group by c.name, cb.name, cb.code
    order by c.name, cb.name
  `;

  console.log(
    JSON.stringify(
      {
        status: "success",
        preservedCounts,
        operationalCounts,
        integrity: {
          brokenCountryBranchLinks: countryBranchLinks.broken_count,
          brokenCityBranchLinks: cityBranchLinks.broken_count,
          ledgersNotResetToOpening: ledgerReset.non_zero_count,
          accountsNotResetToOpening: accountReset.non_reset_count
        },
        enterpriseAccountHistory: historyRows,
        branchPreview
      },
      null,
      2
    )
  );
} finally {
  await sql.end();
}
