import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => line.split("=").map((p) => p.trim()))
);

const dbUrl = env.POSTGRES_URL || env.DATABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
if (!dbUrl) {
  console.error("No database URL found in .env.local!");
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require" });

async function clearData() {
  console.log("Clearing old transactional data and resetting serials...");
  try {
    await sql`
      TRUNCATE TABLE 
        roznamcha_entries, 
        roznamcha_lines,
        purchase_orders,
        goods_entries, 
        serial_trackers 
      CASCADE;
    `;
    console.log("All old data cleared and serials reset to 000001!");
  } catch (err) {
    console.error("Error clearing data:", err);
  } finally {
    await sql.end();
  }
}

clearData();
