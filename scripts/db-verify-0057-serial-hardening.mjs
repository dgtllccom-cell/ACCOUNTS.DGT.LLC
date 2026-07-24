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

async function count(table) {
  const [exists] = await sql`select to_regclass(${`public.${table}`}) as table_name`;
  if (!exists?.table_name) return null;
  const [row] = await sql.unsafe(`select count(*)::int as count from public."${table.replaceAll('"', '""')}"`);
  return row.count;
}

try {
  const [migration] = await sql`
    select name, status, applied_at
    from erp_schema_migrations
    where name = '0057_branch_wise_serial_hardening'
  `;

  const indexRows = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'purchase_orders_country_serial_scoped_uidx',
        'purchase_orders_city_branch_serial_scoped_uidx',
        'purchase_orders_main_branch_serial_scoped_uidx',
        'roznamcha_entries_country_serial_scoped_uidx',
        'roznamcha_entries_city_branch_serial_scoped_uidx',
        'roznamcha_entries_main_branch_serial_scoped_uidx',
        'sales_orders_country_serial_scoped_uidx',
        'sales_orders_city_branch_serial_scoped_uidx',
        'sales_orders_main_branch_serial_scoped_uidx'
      )
    order by indexname
  `;

  const countries = await sql`
    select id, name, iso2, iso3
    from countries
    where deleted_at is null
    order by case when name ilike '%pakistan%' then 0 when name ilike '%united arab%' then 1 else 2 end, name
    limit 2
  `;

  const branches = await sql`
    select id, name, code, 'city' as kind from city_branches where deleted_at is null order by name limit 2
  `;

  let dryRunSerials = [];
  try {
    await sql.begin(async (tx) => {
      for (const country of countries) {
        const [row] = await tx`select next_transaction_serial('country', ${country.id}, ${country.iso3 || country.iso2 || country.name}) as serial`;
        dryRunSerials.push({ scope: 'country', name: country.name, serial: row.serial });
      }
      for (const branch of branches) {
        const [row] = await tx`select next_transaction_serial('branch', ${branch.id}, ${branch.code || branch.name}) as serial`;
        dryRunSerials.push({ scope: 'branch', name: branch.name, code: branch.code, serial: row.serial });
      }
      const [global] = await tx`select next_transaction_serial('global', 'global', 'SA') as serial`;
      dryRunSerials.push({ scope: 'global', name: 'Super Admin', serial: global.serial });
      throw new Error('__ROLLBACK_SERIAL_DRY_RUN__');
    });
  } catch (error) {
    if (error.message !== '__ROLLBACK_SERIAL_DRY_RUN__') throw error;
  }

  const result = {
    migration,
    scopedIndexes: indexRows.map((row) => row.indexname),
    operationalCounts: {
      purchase_orders: await count('purchase_orders'),
      purchase_order_payments: await count('purchase_order_payments'),
      roznamcha_entries: await count('roznamcha_entries'),
      roznamcha_lines: await count('roznamcha_lines'),
      ledger_balances: await count('ledger_balances'),
      transaction_serial_sequences: await count('transaction_serial_sequences')
    },
    preservedCounts: {
      countries: await count('countries'),
      country_branches: await count('country_branches'),
      city_branches: await count('city_branches'),
      profiles: await count('profiles'),
      enterprise_accounts: await count('enterprise_accounts'),
      ledgers: await count('ledgers')
    },
    dryRunSerials,
    sequenceRowsAfterDryRun: await count('transaction_serial_sequences')
  };

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end();
}
