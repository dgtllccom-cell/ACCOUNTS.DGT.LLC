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

const migrationPath = "supabase/migrations/0056_multi_country_transaction_traceability.sql";
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

try {
  await sql`select now()`;
  await sql.unsafe(fs.readFileSync(migrationPath, "utf8"));
  const marker = await sql`
    select name, status, applied_at
    from erp_schema_migrations
    where name = '0056_multi_country_transaction_traceability'
  `;
  console.log(JSON.stringify({ applied: marker.length === 1, marker: marker[0] ?? null }, null, 2));
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
