import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function deleteAll() {
  console.log("Starting deletion of purchase and roznamcha data...");

  const tables = [
    "purchase_order_expenses",
    "purchase_order_items",
    "purchase_order_payments",
    "purchase_order_reports",
    "purchase_orders",
    "roznamcha_lines",
    "roznamcha_entries",
    "ledger_balances",
    "ledgers",
    "journal_lines",
    "journal_entries",
    "ledger_entries"
  ];

  for (const table of tables) {
    console.log(`Deleting from ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (error) {
      console.log(`Failed to delete from ${table}:`, error.message);
    } else {
      console.log(`Successfully deleted from ${table}`);
    }
  }

  console.log("Deletion complete.");
}

deleteAll();
