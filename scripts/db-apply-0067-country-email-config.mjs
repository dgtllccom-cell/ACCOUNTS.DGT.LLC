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

const migrationName = "0067_country_email_configuration_defaults";
const migrationPath = "supabase/migrations/0067_country_email_configuration_defaults.sql";
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

  const rows = await sql`
    select name, iso2, official_email, admin_email, email_domain, email_server_settings->>'officeName' as office_name
    from countries
    where official_email in ('Asmatandbrothers@gmail.com', 'Dgt.llc.com@gmail.com')
    order by name
  `;
  const accounts = await sql`
    select display_name, email_address, scope, is_default, is_active
    from erp_email_accounts
    where lower(email_address) in ('asmatandbrothers@gmail.com', 'dgt.llc.com@gmail.com')
    order by email_address
  `;

  console.log(JSON.stringify({ ok: true, applied: migrationName, countries: rows, emailAccounts: accounts }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
