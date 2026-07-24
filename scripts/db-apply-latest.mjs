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

const migrations = [
  "supabase/migrations/20260626_create_expenses_bills.sql",
  "supabase/migrations/20260626_money_exchange.sql",
  "supabase/migrations/20260626_money_exchange_alter.sql"
];

try {
  await sql`select now()`;
  for (const m of migrations) {
    if (fs.existsSync(m)) {
      console.log("Applying migration " + m + "...");
      const migrationSql = fs.readFileSync(m, "utf8");
      await sql.unsafe(migrationSql);
      console.log("Migration applied successfully.");
    } else {
      console.log("Migration not found: " + m);
    }
  }
} catch (error) {
  console.error("Migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
