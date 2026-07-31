import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const KEPT_MAIN_COUNTRIES = [
  "Tajikistan",
  "Inayatullah",
  "Afghanistan",
  "India",
  "Japan"
];

async function main() {
  console.log("=========================================");
  console.log("  RESETTING ERP TRANSACTION & CITY DATA  ");
  console.log("=========================================\n");

  // 1. Fetch current country branches to identify main branches for the 5 target countries
  const { data: countryBranches, error: cbError } = await supabase
    .from("country_branches")
    .select("id, name, code, is_main, country_id");

  if (cbError) {
    console.error("Error fetching country branches:", cbError.message);
    process.exit(1);
  }

  console.log("Current Country Branches:");
  console.table(countryBranches);

  // 2. Identify city branches to delete
  const { data: cityBranches } = await supabase.from("city_branches").select("id, name, city_name, code");
  console.log(`\nFound ${cityBranches?.length || 0} City Branches to remove.`);

  // 3. List of transactional tables to clean up
  const transactionalTables = [
    "purchase_loading_records",
    "purchase_order_expenses",
    "purchase_order_items",
    "purchase_order_payments",
    "purchase_order_reports",
    "purchase_orders",
    "local_purchases",
    "sales_order_payments",
    "sales_orders",
    "shipping_bl_records",
    "shipping_line_records",
    "shipment_documents",
    "roznamcha_lines",
    "roznamcha_entries",
    "roznamcha_reversals",
    "ledger_entries",
    "ledger_balances",
    "ledger_posting_lines",
    "ledger_posting_batches",
    "ledger_opening_balances",
    "journal_lines",
    "journal_entries",
    "daily_usd_rates",
    "usd_purchase_sales",
    "transactions",
    "reports",
    "report_runs"
  ];

  console.log("\nDeleting transaction and ledger entries across all module tables...");
  for (const table of transactionalTables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.log(`  - ${table}: ${error.message}`);
    } else {
      console.log(`  - ${table}: Cleared successfully.`);
    }
  }

  // 4. Delete all City Branches
  console.log("\nDeleting all City Branches...");
  const { error: deleteCityErr } = await supabase.from("city_branches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteCityErr) {
    console.error("  - city_branches deletion error:", deleteCityErr.message);
  } else {
    console.log("  - city_branches: All city branches deleted successfully.");
  }

  console.log("\n=========================================");
  console.log("  RESET COMPLETED SUCCESSFULLY           ");
  console.log("=========================================");
}

main().catch(console.error);
