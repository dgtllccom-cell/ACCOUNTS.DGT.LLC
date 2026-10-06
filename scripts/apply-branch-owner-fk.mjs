import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
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

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const host = new URL(env.DATABASE_URL.replace("postgresql://", "http://")).hostname;
  console.log("Applying to host:", host);
  const migrationSql = fs.readFileSync("supabase/migrations/20260827_branch_owner_fk.sql", "utf8");
  await sql.unsafe(migrationSql);
  console.log("Migration applied successfully.");

  const cols = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('branches','country_branches','city_branches')
      and column_name in ('owner_customer_id','owner_profile_id')
    order by table_name, column_name
  `;
  console.table(cols);
} catch (error) {
  console.error("Migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
