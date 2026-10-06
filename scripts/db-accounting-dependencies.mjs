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

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const rows = await sql`
    select
      tc.table_name as child_table,
      kcu.column_name as child_column,
      ccu.table_name as parent_table,
      ccu.column_name as parent_column,
      tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name in ('enterprise_accounts', 'accounts', 'ledgers', 'roznamcha_entries', 'ledger_posting_batches')
    order by ccu.table_name, tc.table_name, kcu.column_name
  `;
  console.log(JSON.stringify({ status: "success", rows }, null, 2));
} finally {
  await sql.end();
}
