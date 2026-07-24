import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function clearTransactions() {
  const tables = [
    "purchase_order_reports",
    "purchase_order_items",
    "purchase_order_expenses",
    "purchase_order_payments",
    "purchase_orders",
    "roznamcha_lines",
    "roznamcha_entries",
    "ledger_entries",
    "ledger_balances",
    "journal_lines",
    "journal_reversals",
    "journal_entries",
    "transactions",
    "usd_purchase_sales"
  ];

  console.log("Starting to clear transaction tables...");
  
  try {
    for (const table of tables) {
      console.log(`Truncating ${table}...`);
      await sql.unsafe(`TRUNCATE TABLE ${table} CASCADE;`);
      console.log(`Successfully truncated ${table}`);
    }
    console.log("All specified tables have been cleared successfully.");
  } catch (error) {
    console.error("Error clearing tables:", error);
  } finally {
    await sql.end();
  }
}

clearTransactions();
