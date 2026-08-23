
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let supabaseUrl = "";
let supabaseKey = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.replace("NEXT_PUBLIC_SUPABASE_URL=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
  if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseKey = trimmed.replace("SUPABASE_SERVICE_ROLE_KEY=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// Preserved Core Countries: UAE, Pakistan, Afghanistan, India
const PRESERVED_COUNTRY_ISOS = ["AE", "PK", "AF", "IN"];

// Preserved User Emails:
const PRESERVED_EMAILS = [
  "superadmin@damaan.com",
  "asmatdgtllc@users.damaan.local",
  "afg-country-admin@users.damaan.local"
];

async function runCleanup() {
  console.log("=================================================================");
  console.log("       VPS PRODUCTION DATABASE WIPE & RESET EXECUTION            ");
  console.log("=================================================================\n");

  const checkTables = [
    "purchase_orders", "purchase_order_items", "purchase_order_payments", "purchase_loading_records", "local_purchases",
    "sales_orders", "sales_order_payments",
    "roznamcha_entries", "roznamcha_lines", "ledger_entries", "ledger_balances", "journal_entries", "journal_lines",
    "companies", "customers", "employees", "banks", "warehouses", "city_branches", "accounts"
  ];

  const transactionTables = [
    "purchase_loading_records",
    "purchase_order_payments",
    "purchase_order_expenses",
    "purchase_order_items",
    "purchase_orders",
    "local_purchases",
    "sales_order_payments",
    "sales_orders",
    "roznamcha_reversals",
    "roznamcha_lines",
    "roznamcha_entries",
    "ledger_posting_lines",
    "ledger_posting_batches",
    "ledger_opening_balances",
    "ledger_balances",
    "ledger_entries",
    "journal_lines",
    "journal_entries",
    "daily_usd_rates",
    "usd_purchase_sales",
    "shipping_bl_records",
    "shipping_line_records",
    "shipment_documents",
    "stock_movements",
    "product_inventory_balances",
    "goods",
    "products",
    "account_companies",
    "account_banks",
    "account_warehouses",
    "account_customer_owners",
    "accounts",
    "customer_contacts",
    "company_contacts",
    "customers",
    "companies",
    "banks",
    "warehouses",
    "employees",
    "city_branches"
  ];

  console.log("--> Deleting transactional and test master records from VPS...");
  for (const table of transactionTables) {
    try {
      const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.log("  * " + table + ": " + error.message);
      } else {
        console.log("  * " + table + ": Cleared to 0 rows");
      }
    } catch (err) {
      console.log("  * " + table + " err: " + err.message);
    }
  }

  // Delete non-core countries (Keep only AE, PK, AF, IN)
  console.log("\n--> Preserving only 4 Main Countries (UAE, PK, AF, IN)...");
  const { data: countries } = await supabase.from("countries").select("id, name, iso2");
  for (const c of countries || []) {
    if (!c.iso2 || !PRESERVED_COUNTRY_ISOS.includes(c.iso2.toUpperCase())) {
      console.log("  - Deleting non-core country: " + c.name + " (" + c.iso2 + ")");
      await supabase.from("countries").delete().eq("id", c.id);
    } else {
      console.log("  + PRESERVED CORE COUNTRY: " + c.name + " (" + c.iso2 + ")");
    }
  }

  // Delete non-admin test users
  console.log("\n--> Cleaning demo / test auth users...");
  const { data: usersData } = await supabase.auth.admin.listUsers();
  for (const u of usersData?.users || []) {
    if (!PRESERVED_EMAILS.includes(u.email)) {
      console.log("  - Deleting test user: " + u.email);
      await supabase.from("profiles").delete().eq("id", u.id);
      await supabase.auth.admin.deleteUser(u.id);
    } else {
      console.log("  + PRESERVED USER: " + u.email);
    }
  }

  // Verification
  const afterCounts = {};
  for (const t of checkTables) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    afterCounts[t] = count ?? 0;
  }

  const { data: finalCountries } = await supabase.from("countries").select("id, name, iso2, is_active").order("name");
  const { data: finalBranches } = await supabase.from("country_branches").select("id, name, code, is_main");
  const { data: finalUsers } = await supabase.auth.admin.listUsers();

  console.log("\n=================================================================");
  console.log("       VPS PRODUCTION DATABASE STATUS AFTER CLEANUP               ");
  console.log("=================================================================");
  console.table(afterCounts);

  console.log("\n--> ACTIVE COUNTRIES (" + (finalCountries?.length || 0) + "):");
  finalCountries?.forEach(c => console.log("  - " + c.name + " (" + c.iso2 + ")"));

  console.log("\n--> MAIN COUNTRY BRANCHES (" + (finalBranches?.length || 0) + "):");
  finalBranches?.forEach(b => console.log("  - " + b.name + " (" + b.code + ") [is_main: " + b.is_main + "]"));

  console.log("\n--> PRESERVED USERS (" + (finalUsers?.users?.length || 0) + "):");
  finalUsers?.users?.forEach(u => console.log("  - " + u.email + " (ID: " + u.id + ")"));

  console.log("\n>>> VPS PRODUCTION IS FRESH AND READY FOR REAL TRANSACTIONS! <<<\n");
}

runCleanup().catch(e => {
  console.error("Cleanup Error:", e);
  process.exit(1);
});
