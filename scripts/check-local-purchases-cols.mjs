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
  const cols = await sql`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='local_purchases'
    order by ordinal_position
  `;
  console.table(cols);
} finally {
  await sql.end();
}
