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
  console.error("DATABASE_URL is not set in .env.local.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15
});

const migrationPath = "supabase/migrations/0032_erp_serial_system.sql";

try {
  await sql`select now()`;
  console.log("Applying ERP Serial System migration (0032)...");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);
  console.log("ERP Serial System Migration applied successfully!");
} catch (error) {
  console.error("Migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
