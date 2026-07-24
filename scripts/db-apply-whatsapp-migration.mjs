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

const migrationPath = "supabase/migrations/0036_add_whatsapp_and_email_scoping_rules.sql";

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

try {
  await sql`select now()`;
  console.log("Applying migration 0036...");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);

  const checks = {
    countriesWhatsapp: await columnExists("countries", "whatsapp_number"),
    countryBranchesWhatsapp: await columnExists("country_branches", "whatsapp_number"),
    cityBranchesWhatsapp: await columnExists("city_branches", "whatsapp_number")
  };

  console.log(JSON.stringify(checks, null, 2));

  if (Object.values(checks).some((value) => !value)) {
    console.error("Migration verification failed.");
    process.exit(1);
  }
  console.log("Migration 0036 applied successfully.");
} catch (error) {
  console.error("Migration 0036 failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
