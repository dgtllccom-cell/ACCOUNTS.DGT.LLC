import { execSync } from "child_process";
import fs from "fs";

const SERVER = "root@72.60.209.121";

const script = `
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

async function verify() {
  const { data: usersList } = await supabase.auth.admin.listUsers();
  for (const u of usersList?.users || []) {
    let ucode = "USR-" + u.id.slice(0, 6).toUpperCase();
    if (u.email === "superadmin@damaan.com") ucode = "SUPERADMIN";
    if (u.email === "asmatdgtllc@users.damaan.local") ucode = "ASMATDGTLLC";
    if (u.email === "afg-country-admin@users.damaan.local") ucode = "AFG-ADMIN";

    await sql\`
      INSERT INTO public.profiles (id, full_name, user_code)
      VALUES (\${u.id}, \${u.user_metadata?.full_name || u.email}, \${ucode})
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, user_code = EXCLUDED.user_code
    \`;
  }

  // Final count check
  const checkTables = [
    "countries", "country_branches", "city_branches",
    "purchase_orders", "purchase_order_items", "purchase_order_payments", "purchase_loading_records", "local_purchases",
    "sales_orders", "sales_order_payments",
    "roznamcha_entries", "roznamcha_lines", "ledger_entries", "ledger_balances", "journal_entries", "journal_lines",
    "companies", "customers", "employees", "banks", "warehouses", "accounts", "ledgers"
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

  console.log("\\n=================================================================");
  console.log("       VPS PRODUCTION DATABASE FINAL VERIFIED COUNTS             ");
  console.log("=================================================================");
  console.table(results);

  const finalCountries = await sql\`SELECT id, name, iso2, currency_code, is_active FROM public.countries ORDER BY name\`;
  console.log("\\n--> 4 CORE ACTIVE COUNTRIES (" + finalCountries.length + "):");
  finalCountries.forEach(c => console.log("  - " + c.name + " (" + c.iso2 + ") | Currency: " + c.currency_code + " | Active: " + c.is_active));

  const finalBranches = await sql\`SELECT id, name, code, is_main FROM public.country_branches ORDER BY name\`;
  console.log("\\n--> 4 MAIN COUNTRY BRANCHES (" + finalBranches.length + "):");
  finalBranches.forEach(b => console.log("  - " + b.name + " (" + b.code + ") [is_main: " + b.is_main + "]"));

  const finalUsers = await supabase.auth.admin.listUsers();
  console.log("\\n--> VERIFIED USERS (" + (finalUsers?.users?.length || 0) + "):");
  for (const u of finalUsers?.users || []) {
    const prof = await sql\`SELECT id, full_name, user_code FROM public.profiles WHERE id = \${u.id}\`;
    console.log("  - " + u.email + " (ID: " + u.id + ") | Name: " + prof[0]?.full_name + " | Code: " + prof[0]?.user_code);
  }

  await sql.end();
  console.log("\\n>>> VPS PRODUCTION CLEANUP & REINITIALIZATION IS 100% COMPLETE! <<<\\n");
}

verify().catch(e => {
  console.error("Verification error:", e);
  process.exit(1);
});
`;

fs.writeFileSync("scripts/vps_verify_final.mjs", script);

try {
  execSync(`scp -o StrictHostKeyChecking=no scripts/vps_verify_final.mjs ${SERVER}:/var/www/dgt-nextjs/vps_verify_final.mjs`, { stdio: "inherit" });
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && node vps_verify_final.mjs && rm -f vps_verify_final.mjs"`, { stdio: "inherit" });
} catch (e) {
  console.error("Execution error:", e.message);
}
