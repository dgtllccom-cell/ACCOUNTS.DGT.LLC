import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const migrationName = "0068_communication_center";
const migrationPath = "supabase/migrations/0068_communication_center.sql";
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

try {
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
  const existing = await sql`select name, status from erp_schema_migrations where name = ${migrationName}`;
  if (existing.length && existing[0].status === "applied") {
    console.log(`${migrationName} already applied`);
    process.exit(0);
  }

  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);

  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name like 'communication_center_%'
    order by table_name
  `;
  const profiles = await sql`
    select scope, office_name, email_address, is_default, is_active
    from communication_center_profiles
    order by created_at desc
    limit 10
  `;

  console.log(JSON.stringify({ ok: true, applied: migrationName, tables, profiles }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
