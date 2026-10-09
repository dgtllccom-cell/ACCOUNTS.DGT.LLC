import postgres from "postgres";
import fs from "fs";

const url = process.env.DATABASE_URL;
console.log("Connecting to:", url?.split("@")[1]);

if (!url || !url.includes("csesvyxxjivnkkozgopt")) {
  console.error("NOT DEV DB! Aborting.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require" });

async function applyMigration() {
  const migration = fs.readFileSync("supabase/migrations/20261009_daily_payments_multi_payment_support.sql", "utf8");
  await sql.unsafe(migration);
  console.log("Successfully applied multi-payment support migration to DEV database csesvyxxjivnkkozgopt!");
  await sql.end();
}

applyMigration().catch(console.error);
