import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });
try {
  const migrationSql = fs.readFileSync("supabase/migrations/20260827_local_purchase_master_fk.sql", "utf8");
  await sql.unsafe(migrationSql);
  console.log("Applied.");
  const cols = await sql`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='local_purchases'
      and column_name in ('warehouse_id','supplier_person_id')
  `;
  console.table(cols);
} finally {
  await sql.end();
}
