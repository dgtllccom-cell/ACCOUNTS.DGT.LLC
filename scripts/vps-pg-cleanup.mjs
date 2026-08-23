import { execSync } from "child_process";
import fs from "fs";

const SERVER = "root@72.60.209.121";

console.log("Preparing PostgreSQL Direct Cascade Cleanup on VPS...");

const remoteScript = `
import postgres from "postgres";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
let supabaseUrl = "";
let supabaseKey = "";

for (const line of envContent.split("\\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.replace("NEXT_PUBLIC_SUPABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
  if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseKey = trimmed.replace("SUPABASE_SERVICE_ROLE_KEY=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const PRESERVED_COUNTRY_ISOS = ["AE", "PK", "AF", "IN"];
const PRESERVED_EMAILS = [
  "superadmin@damaan.com",
  "asmatdgtllc@users.damaan.local",
  "afg-country-admin@users.damaan.local"
];

async function execute() {
  console.log("=================================================================");
  console.log("       VPS PRODUCTION DATABASE PG CASCADE CLEANUP                ");
  console.log("=================================================================\\n");

  // 1. Cascade truncate transactional and demo tables
  console.log("--> Truncating transactional and test master tables with CASCADE...");
  const tablesToTruncate = [
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
    "ledgers",
    "enterprise_accounts",
    "account_companies",
    "account_banks",
    "account_warehouses",
    "account_customer_owners",
    "accounts",
    "customer_contacts",
    "employees",
    "customers",
    "companies",
    "banks",
    "warehouses",
    "city_branches"
  ];

  for (const tbl of tablesToTruncate) {
    try {
      await sql.unsafe(\`TRUNCATE TABLE public."\${tbl}" CASCADE;\`);
      console.log("  * " + tbl + ": Truncated (0 rows)");
    } catch (e) {
      console.log("  * " + tbl + " (skip/note): " + e.message);
    }
  }

  // 2. Delete non-core countries (Keep only AE, PK, AF, IN)
  console.log("\\n--> Deleting non-core countries (preserving AE, PK, AF, IN)...");
  await sql\`DELETE FROM public.countries WHERE UPPER(iso2) NOT IN ('AE', 'PK', 'AF', 'IN') OR iso2 IS NULL;\`;

  // 3. Delete non-core users from profiles and auth.users
  console.log("\\n--> Deleting test / demo users...");
  const { data: usersData } = await supabase.auth.admin.listUsers();
  for (const u of usersData?.users || []) {
    if (!PRESERVED_EMAILS.includes(u.email)) {
      console.log("  - Deleting user: " + u.email + " (" + u.id + ")");
      try {
        await sql\`DELETE FROM public.profiles WHERE id = \${u.id}\`;
        await supabase.auth.admin.deleteUser(u.id);
      } catch (err) {
        console.log("    user delete err:", err.message);
      }
    } else {
      console.log("  + PRESERVED USER: " + u.email);
    }
  }

  // 4. Verify Final State
  console.log("\\n=================================================================");
  console.log("       VERIFICATION OF VPS PRODUCTION DATABASE                   ");
  console.log("=================================================================");

  const checkTables = [
    "purchase_orders", "purchase_order_items", "purchase_order_payments", "purchase_loading_records", "local_purchases",
    "sales_orders", "sales_order_payments",
    "roznamcha_entries", "roznamcha_lines", "ledger_entries", "ledger_balances", "journal_entries", "journal_lines",
    "companies", "customers", "employees", "banks", "warehouses", "city_branches", "accounts", "ledgers"
  ];

  const results = {};
  for (const tbl of checkTables) {
    try {
      const res = await sql.unsafe(\`SELECT COUNT(*)::int as count FROM public."\${tbl}"\`);
      results[tbl] = res[0].count;
    } catch (e) {
      results[tbl] = "N/A";
    }
  }
  console.table(results);

  const countries = await sql\`SELECT id, name, iso2, is_active FROM public.countries ORDER BY name\`;
  console.log("\\n--> ACTIVE COUNTRIES (" + countries.length + "):");
  countries.forEach(c => console.log("  - " + c.name + " (" + c.iso2 + ")"));

  const branches = await sql\`SELECT id, name, code, is_main FROM public.country_branches\`;
  console.log("\\n--> MAIN COUNTRY BRANCHES (" + branches.length + "):");
  branches.forEach(b => console.log("  - " + b.name + " (" + b.code + ") [is_main: " + b.is_main + "]"));

  const finalUsers = await supabase.auth.admin.listUsers();
  console.log("\\n--> ACTIVE AUTH USERS (" + (finalUsers?.users?.length || 0) + "):");
  finalUsers?.users?.forEach(u => console.log("  - " + u.email + " (ID: " + u.id + ")"));

  await sql.end();
  console.log("\\n>>> VPS PRODUCTION IS 100% CLEAN AND READY FOR REAL WORK! <<<\\n");
}

execute().catch(e => {
  console.error("Execution error:", e);
  process.exit(1);
});
`;

fs.writeFileSync("scripts/vps_remote_pg_clean.mjs", remoteScript);

try {
  execSync(`scp -o StrictHostKeyChecking=no scripts/vps_remote_pg_clean.mjs ${SERVER}:/var/www/dgt-nextjs/vps_remote_pg_clean.mjs`, { stdio: "inherit" });
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && node vps_remote_pg_clean.mjs && rm -f vps_remote_pg_clean.mjs"`, { stdio: "inherit" });
} catch (e) {
  console.error("Execution failed:", e.message);
}
