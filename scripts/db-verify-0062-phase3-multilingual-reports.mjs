import fs from "node:fs";
import postgres from "postgres";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index === -1) continue;
  env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
}

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

try {
  const marker = await sql`select name, status from erp_schema_migrations where name = '0062_phase3_multilingual_reports'`;
  const columns = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'record_translations'
      and column_name in ('language_texts','translation_status','translated_by_engine','translated_at')
    order by column_name
  `;
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('translation_generation_jobs','erp_report_templates','erp_report_exports')
    order by table_name
  `;
  console.log(JSON.stringify({
    marker,
    columns: columns.map((row) => row.column_name),
    tables: tables.map((row) => row.table_name)
  }, null, 2));
} finally {
  await sql.end();
}