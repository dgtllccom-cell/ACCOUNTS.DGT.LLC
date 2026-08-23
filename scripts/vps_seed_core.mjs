
import postgres from "postgres";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
let supabaseUrl = "";
let supabaseKey = "";

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.replace("NEXT_PUBLIC_SUPABASE_URL=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
  if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseKey = trimmed.replace("SUPABASE_SERVICE_ROLE_KEY=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function seed() {
  const coreCountries = [
    {
      name: "United Arab Emirates",
      iso2: "AE",
      iso3: "ARE",
      currency_code: "AED",
      reporting_currency: "USD",
      is_active: true,
      official_email: "ae.office@dgt.llc",
      admin_email: "ae.admin@dgt.llc",
      email_domain: "dgt.llc",
      phone_code: "+971"
    },
    {
      name: "Pakistan",
      iso2: "PK",
      iso3: "PAK",
      currency_code: "PKR",
      reporting_currency: "USD",
      is_active: true,
      official_email: "pk.office@dgt.llc",
      admin_email: "pk.admin@dgt.llc",
      email_domain: "dgt.llc",
      phone_code: "+92"
    },
    {
      name: "Afghanistan",
      iso2: "AF",
      iso3: "AFG",
      currency_code: "AFN",
      reporting_currency: "USD",
      is_active: true,
      official_email: "af.office@dgt.llc",
      admin_email: "af.admin@dgt.llc",
      email_domain: "dgt.llc",
      phone_code: "+93"
    },
    {
      name: "India",
      iso2: "IN",
      iso3: "IND",
      currency_code: "INR",
      reporting_currency: "USD",
      is_active: true,
      official_email: "in.office@dgt.llc",
      admin_email: "in.admin@dgt.llc",
      email_domain: "dgt.llc",
      phone_code: "+91"
    }
  ];

  const countryIds = {};
  for (const c of coreCountries) {
    const inserted = await sql`
      INSERT INTO public.countries (name, iso2, iso3, currency_code, reporting_currency, is_active, official_email, admin_email, email_domain, phone_code)
      VALUES (${c.name}, ${c.iso2}, ${c.iso3}, ${c.currency_code}, ${c.reporting_currency}, ${c.is_active}, ${c.official_email}, ${c.admin_email}, ${c.email_domain}, ${c.phone_code})
      RETURNING id
    `;
    countryIds[c.iso2] = inserted[0].id;
    console.log("  + Inserted Country:", c.name, "(" + c.iso2 + ") -> ID:", inserted[0].id);
  }

  const branches = [
    { countryIso: "AE", name: "United Arab Emirates Main Branch", code: "ARE-MAIN-001", local_currency: "AED", email: "ae.main@dgt.llc" },
    { countryIso: "PK", name: "Pakistan Main Branch", code: "PAK-MAIN-001", local_currency: "PKR", email: "pk.main@dgt.llc" },
    { countryIso: "AF", name: "Afghanistan Main Branch", code: "AFG-MAIN-001", local_currency: "AFN", email: "af.main@dgt.llc" },
    { countryIso: "IN", name: "India Main Branch", code: "IND-MAIN-001", local_currency: "INR", email: "in.main@dgt.llc" }
  ];

  for (const b of branches) {
    const cid = countryIds[b.countryIso];
    const insBranch = await sql`
      INSERT INTO public.country_branches (country_id, name, code, local_currency, is_main, status, email)
      VALUES (${cid}, ${b.name}, ${b.code}, ${b.local_currency}, true, 'active', ${b.email})
      RETURNING id
    `;
    await sql`
      UPDATE public.countries SET default_country_branch_id = ${insBranch[0].id} WHERE id = ${cid}
    `;
    console.log("  + Inserted Main Branch:", b.name, "(" + b.code + ")");
  }

  // Ensure 2 Super Admin accounts exist and are verified
  console.log("\n--> Ensuring Super Admin Users exist on VPS...");
  
  const superAdmin1 = await supabase.auth.admin.createUser({
    email: "superadmin@damaan.com",
    password: "Password123!",
    email_confirm: true,
    user_metadata: { full_name: "Super Admin", role: "super_admin" }
  }).catch(() => null);

  const superAdmin2 = await supabase.auth.admin.createUser({
    email: "asmatdgtllc@users.damaan.local",
    password: "Password123!",
    email_confirm: true,
    user_metadata: { full_name: "ASMATULLAH", user_code: "ASMATDGTLLC", role: "super_admin" }
  }).catch(() => null);

  const afgAdmin = await supabase.auth.admin.createUser({
    email: "afg-country-admin@users.damaan.local",
    password: "Password123!",
    email_confirm: true,
    user_metadata: { full_name: "Afghanistan Admin", role: "country_admin" }
  }).catch(() => null);

  const { data: usersList } = await supabase.auth.admin.listUsers();
  for (const u of usersList?.users || []) {
    const isSuper = u.email === "superadmin@damaan.com" || u.email === "asmatdgtllc@users.damaan.local";
    await sql`
      INSERT INTO public.profiles (id, full_name, email, role)
      VALUES (${u.id}, ${u.user_metadata?.full_name || u.email}, ${u.email}, ${isSuper ? 'super_admin' : 'country_admin'})
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name
    `;
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
      const res = await sql.unsafe(`SELECT COUNT(*)::int as count FROM public."${tbl}"`);
      results[tbl] = res[0].count;
    } catch (e) {
      results[tbl] = "N/A";
    }
  }

  console.log("\n=================================================================");
  console.log("       VPS PRODUCTION DATABASE RECORD COUNTS (AFTER CLEANUP)     ");
  console.log("=================================================================");
  console.table(results);

  const finalCountries = await sql`SELECT id, name, iso2, currency_code, is_active FROM public.countries ORDER BY name`;
  console.log("\n--> 4 CORE COUNTRIES:");
  finalCountries.forEach(c => console.log("  - " + c.name + " (" + c.iso2 + ") | Currency: " + c.currency_code + " | Active: " + c.is_active));

  const finalBranches = await sql`SELECT id, name, code, is_main FROM public.country_branches`;
  console.log("\n--> 4 MAIN COUNTRY BRANCHES:");
  finalBranches.forEach(b => console.log("  - " + b.name + " (" + b.code + ") [is_main: " + b.is_main + "]"));

  const finalUsers = await supabase.auth.admin.listUsers();
  console.log("\n--> VERIFIED USERS (" + (finalUsers?.users?.length || 0) + "):");
  for (const u of finalUsers?.users || []) {
    console.log("  - " + u.email + " (ID: " + u.id + ")");
  }

  await sql.end();
}

seed().catch(e => {
  console.error("Fatal seed error:", e);
  process.exit(1);
});
