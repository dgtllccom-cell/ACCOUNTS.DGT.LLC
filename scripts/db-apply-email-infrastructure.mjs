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
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15
});

const migrationPath = "supabase/migrations/0035_email_management_infrastructure.sql";

async function columnExists(tableName, columnName) {
  const [row] = await sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as exists
  `;
  return Boolean(row.exists);
}

async function tableExists(tableName) {
  const [row] = await sql`
    select to_regclass(${`public.${tableName}`}) as table_name
  `;
  return Boolean(row.table_name);
}

try {
  await sql`select now()`;
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);

  const checks = {
    countriesOfficialEmail: await columnExists("countries", "official_email"),
    countriesAdminEmail: await columnExists("countries", "admin_email"),
    providersTable: await tableExists("erp_email_providers"),
    accountsTable: await tableExists("erp_email_accounts"),
    messagesTable: await tableExists("erp_email_messages")
  };

  console.log(JSON.stringify(checks, null, 2));

  if (Object.values(checks).some((value) => !value)) {
    console.error("Email infrastructure migration verification failed.");
    process.exit(1);
  }
} catch (error) {
  console.error("email infrastructure migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
