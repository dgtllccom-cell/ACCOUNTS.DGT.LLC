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
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const migrationPath = "supabase/migrations/0057_branch_wise_serial_hardening.sql";
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

try {
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql`select now()`;
  await sql.unsafe(migrationSql);
  const [marker] = await sql`
    select name, status, applied_at
    from erp_schema_migrations
    where name = '0057_branch_wise_serial_hardening'
  `;
  console.log(JSON.stringify({ status: "success", migration: marker ?? null }, null, 2));
} catch (error) {
  console.error("0057 migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
