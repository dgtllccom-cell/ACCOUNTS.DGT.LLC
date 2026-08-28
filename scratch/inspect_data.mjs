import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== COUNTRY BRANCHES ===");
  const { data: countryBranches, error: cErr } = await supabase.from('country_branches').select('id, name, code');
  if (cErr) console.error("Country branches error:", cErr);
  else console.table(countryBranches);

  console.log("\n=== CITY BRANCHES ===");
  const { data: cityBranches, error: cbErr } = await supabase.from('city_branches').select('id, name, code, country_branch_id');
  if (cbErr) console.error("City branches error:", cbErr);
  else console.table(cityBranches);

  console.log("\n=== COUNT OF TRANSACTION/LEDGER TABLES ===");
  const tables = [
    "roznamcha_entries",
    "roznamcha_lines",
    "ledger_entries",
    "ledger_balances",
    "ledgers",
    "journal_entries",
    "journal_lines",
    "purchase_orders",
    "purchase_order_items",
    "purchase_order_expenses",
    "purchase_order_payments",
    "purchase_order_reports"
  ];

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${table}: error (${error.message})`);
    } else {
      console.log(`Table ${table}: ${count} rows`);
    }
  }
}

main().catch(console.error);
