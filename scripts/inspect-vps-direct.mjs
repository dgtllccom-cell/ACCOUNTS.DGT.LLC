import { execSync } from "child_process";

const SERVER = "root@72.60.209.121";

const scriptContent = `
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let supabaseUrl = "";
let supabaseKey = "";
for (const line of envContent.split("\\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.replace("NEXT_PUBLIC_SUPABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
  if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseKey = trimmed.replace("SUPABASE_SERVICE_ROLE_KEY=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
}

console.log("Supabase URL:", supabaseUrl);
console.log("Service Key Found:", !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function check() {
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  console.log("\\nAUTH USERS ON VPS (" + (users?.users?.length || 0) + "):");
  users?.users?.forEach(u => console.log(" -", u.email, "| ID:", u.id, "| Meta:", JSON.stringify(u.user_metadata || {})));

  const { data: countries } = await supabase.from("countries").select("id, name, iso2, is_active").order("name");
  console.log("\\nCOUNTRIES ON VPS (" + (countries?.length || 0) + "):");
  countries?.forEach(c => console.log(" -", c.name, "(" + c.iso2 + ")", "| ID:", c.id, "| Active:", c.is_active));

  const { data: countryBranches } = await supabase.from("country_branches").select("id, name, code, is_main, country_id");
  console.log("\\nCOUNTRY BRANCHES ON VPS (" + (countryBranches?.length || 0) + "):");
  countryBranches?.forEach(b => console.log(" -", b.name, "(" + b.code + ")", "| is_main:", b.is_main, "| ID:", b.id, "| CountryId:", b.country_id));

  const tables = [
    "purchase_orders", "purchase_order_items", "purchase_order_payments", "purchase_order_expenses", "purchase_loading_records", "local_purchases",
    "sales_orders", "sales_order_payments",
    "roznamcha_entries", "roznamcha_lines", "roznamcha_reversals",
    "ledger_entries", "ledger_balances", "ledger_posting_lines", "ledger_posting_batches", "journal_entries", "journal_lines",
    "companies", "customers", "employees", "banks", "warehouses", "city_branches", "accounts"
  ];

  console.log("\\nTABLE RECORD COUNTS ON VPS:");
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(" - " + t + ":", error ? "ERROR: " + error.message : count);
  }
}

check().catch(e => { console.error("Error:", e.message); process.exit(1); });
`;

const base64Content = Buffer.from(scriptContent).toString("base64");

try {
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "echo '${base64Content}' | base64 -d > /tmp/check_vps_db.js && cd /var/www/dgt-nextjs && NODE_PATH=/var/www/dgt-nextjs/node_modules node /tmp/check_vps_db.js"`, {
    stdio: "inherit"
  });
} catch (e) {
  console.error("SSH execution error:", e.message);
}
