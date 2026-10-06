import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}
await loadEnvFile(path.join(process.cwd(), ".env.local"));
await loadEnvFile(path.join(process.cwd(), ".env"));
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
const sql = postgres(databaseUrl, { max: 1, ssl: "require", connect_timeout: 10, idle_timeout: 5 });
try {
  const checks = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('goods','countries','enterprise_accounts','cities')
      and column_name in ('name_en','name_ur','name_ar','name_fa','name_ps')
    order by table_name, column_name
  `;
  const funcs = await sql`
    select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname in ('erp_resolve_language_text')
  `;
  console.log(JSON.stringify({ columns: checks, functions: funcs }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
