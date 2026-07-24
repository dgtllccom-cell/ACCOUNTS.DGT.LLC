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

const migrationPath = "supabase/migrations/0037_add_raw_password_to_profiles.sql";

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
  console.log("Applying migration 0037...");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);

  const rawPasswordExists = await columnExists("profiles", "raw_password");
  console.log(`Verification: raw_password column exists on profiles table = ${rawPasswordExists}`);

  if (!rawPasswordExists) {
    console.error("Migration verification failed.");
    process.exit(1);
  }
  console.log("Migration 0037 applied successfully.");
} catch (error) {
  console.error("Migration 0037 failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
