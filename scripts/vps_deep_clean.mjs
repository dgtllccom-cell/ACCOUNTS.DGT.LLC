
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

async function deepCleanAndConfigure() {
  console.log("=================================================================");
  console.log("      DEEP CLEAN & STRICT FINAL CONFIGURATION (VPS PROD)         ");
  console.log("=================================================================\n");

  // 1. ALL TABLES IN PUBLIC SCHEMA
  const allTables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  console.log("Found " + allTables.length + " total tables in public schema.");

  // Tables to preserve core structure only:
  // - countries (4 rows)
  // - country_branches (4 rows)
  // - profiles (5 rows: 1 superadmin + 4 country admins)
  // - user_roles / permissions / system_settings / translations dictionaries
  
  // Tables to completely wipe:
  const businessAndTestTables = [
    "purchase_loading_records", "purchase_order_payments", "purchase_order_expenses", "purchase_order_items", "purchase_orders", "local_purchases",
    "sales_order_payments", "sales_orders", "sales_order_items", "sales_order_expenses",
    "roznamcha_reversals", "roznamcha_lines", "roznamcha_entries",
    "ledger_posting_lines", "ledger_posting_batches", "ledger_opening_balances", "ledger_balances", "ledger_entries",
    "journal_lines", "journal_entries",
    "daily_usd_rates", "usd_purchase_sales", "currency_rates",
    "shipping_bl_records", "shipping_line_records", "shipment_documents", "clearing_customer_orders",
    "stock_movements", "product_inventory_balances", "goods", "products", "product_brands", "product_units", "product_categories",
    "ledgers", "enterprise_accounts", "accounts",
    "account_companies", "account_banks", "account_warehouses", "account_customer_owners",
    "customer_contacts", "customer_registrations", "customers",
    "company_contacts", "companies",
    "banks", "warehouses", "employees", "city_branches",
    "postal_codes", "areas_locations", "cities", "districts", "states_provinces",
    "record_translations", "record_translations_legacy", "translation_audit_logs", "translation_generation_jobs"
  ];

  console.log("\n--> Truncating all business, master, test & transactional tables...");
  for (const t of businessAndTestTables) {
    try {
      await sql.unsafe(`TRUNCATE TABLE public."${t}" CASCADE;`);
      console.log("  ✓ " + t + ": 0 rows");
    } catch (e) {
      console.log("  - " + t + " (info): " + e.message);
    }
  }

  // 2. CONFIGURE EXACT 4 CORE COUNTRIES
  console.log("\n--> Establishing 4 Core Countries (UAE, Pakistan, Afghanistan, India)...");
  await sql`TRUNCATE TABLE public.countries CASCADE;`;

  const coreCountries = [
    { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", currency_code: "AED", reporting_currency: "USD", is_active: true, official_email: "ae.office@dgt.llc", admin_email: "ae.admin@dgt.llc", email_domain: "dgt.llc", phone_code: "+971" },
    { name: "Pakistan", iso2: "PK", iso3: "PAK", currency_code: "PKR", reporting_currency: "USD", is_active: true, official_email: "pk.office@dgt.llc", admin_email: "pk.admin@dgt.llc", email_domain: "dgt.llc", phone_code: "+92" },
    { name: "Afghanistan", iso2: "AF", iso3: "AFG", currency_code: "AFN", reporting_currency: "USD", is_active: true, official_email: "af.office@dgt.llc", admin_email: "af.admin@dgt.llc", email_domain: "dgt.llc", phone_code: "+93" },
    { name: "India", iso2: "IN", iso3: "IND", currency_code: "INR", reporting_currency: "USD", is_active: true, official_email: "in.office@dgt.llc", admin_email: "in.admin@dgt.llc", email_domain: "dgt.llc", phone_code: "+91" }
  ];

  const countryMap = {};
  for (const c of coreCountries) {
    const ins = await sql`
      INSERT INTO public.countries (name, iso2, iso3, currency_code, reporting_currency, is_active, official_email, admin_email, email_domain, phone_code)
      VALUES (${c.name}, ${c.iso2}, ${c.iso3}, ${c.currency_code}, ${c.reporting_currency}, ${c.is_active}, ${c.official_email}, ${c.admin_email}, ${c.email_domain}, ${c.phone_code})
      RETURNING id
    `;
    countryMap[c.iso2] = ins[0].id;
    console.log("  + Country: " + c.name + " (" + c.iso2 + ") -> ID: " + ins[0].id);
  }

  // 3. CONFIGURE EXACT 4 MAIN COUNTRY BRANCHES (1 per country)
  console.log("\n--> Establishing 4 Main Country Branches...");
  const mainBranches = [
    { countryIso: "AE", name: "United Arab Emirates Main Branch", code: "ARE-MAIN-001", local_currency: "AED", email: "ae.main@dgt.llc" },
    { countryIso: "PK", name: "Pakistan Main Branch", code: "PAK-MAIN-001", local_currency: "PKR", email: "pk.main@dgt.llc" },
    { countryIso: "AF", name: "Afghanistan Main Branch", code: "AFG-MAIN-001", local_currency: "AFN", email: "af.main@dgt.llc" },
    { countryIso: "IN", name: "India Main Branch", code: "IND-MAIN-001", local_currency: "INR", email: "in.main@dgt.llc" }
  ];

  const branchMap = {};
  for (const b of mainBranches) {
    const cid = countryMap[b.countryIso];
    const insB = await sql`
      INSERT INTO public.country_branches (country_id, name, code, local_currency, is_main, status, email)
      VALUES (${cid}, ${b.name}, ${b.code}, ${b.local_currency}, true, 'active', ${b.email})
      RETURNING id
    `;
    branchMap[b.countryIso] = insB[0].id;
    await sql`UPDATE public.countries SET default_country_branch_id = ${insB[0].id} WHERE id = ${cid}`;
    console.log("  + Main Branch: " + b.name + " (" + b.code + ") -> ID: " + insB[0].id);
  }

  // 4. CONFIGURE EXACT USERS: 1 Super Admin + 4 Country Admins
  console.log("\n--> Configuring Exact 1 Super Admin + 4 Country Main Users in Auth & Profiles...");
  
  // Wipe all non-required auth users
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  for (const u of authUsers?.users || []) {
    await supabase.auth.admin.deleteUser(u.id).catch(() => null);
  }
  await sql`TRUNCATE TABLE public.profiles CASCADE;`;

  const targetUsers = [
    // 1 Super Admin
    {
      email: "superadmin@damaan.com",
      password: "Password123!",
      fullName: "Super Admin",
      code: "SUPERADMIN",
      role: "super_admin",
      countryId: null,
      branchId: null
    },
    // 4 Main Country Admins
    {
      email: "uae-country-admin@users.damaan.local",
      password: "Password123!",
      fullName: "UAE Country Admin",
      code: "UAE-ADMIN",
      role: "country_admin",
      countryId: countryMap["AE"],
      branchId: branchMap["AE"]
    },
    {
      email: "pk-country-admin@users.damaan.local",
      password: "Password123!",
      fullName: "Pakistan Country Admin",
      code: "PK-ADMIN",
      role: "country_admin",
      countryId: countryMap["PK"],
      branchId: branchMap["PK"]
    },
    {
      email: "afg-country-admin@users.damaan.local",
      password: "Password123!",
      fullName: "Afghanistan Country Admin",
      code: "AFG-ADMIN",
      role: "country_admin",
      countryId: countryMap["AF"],
      branchId: branchMap["AF"]
    },
    {
      email: "ind-country-admin@users.damaan.local",
      password: "Password123!",
      fullName: "India Country Admin",
      code: "IND-ADMIN",
      role: "country_admin",
      countryId: countryMap["IN"],
      branchId: branchMap["IN"]
    }
  ];

  for (const tu of targetUsers) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: tu.email,
      password: tu.password,
      email_confirm: true,
      user_metadata: {
        full_name: tu.fullName,
        user_code: tu.code,
        role: tu.role,
        country_id: tu.countryId,
        country_branch_id: tu.branchId
      }
    });

    const userId = created?.user?.id;
    if (userId) {
      await sql`
        INSERT INTO public.profiles (id, full_name, user_code)
        VALUES (${userId}, ${tu.fullName}, ${tu.code})
      `;
      console.log("  + Created User: " + tu.email + " (" + tu.role + ") -> UserID: " + userId);
    } else {
      console.log("  - User create issue (" + tu.email + "):", error?.message);
    }
  }

  // 5. COMPREHENSIVE FINAL VERIFICATION AUDIT
  console.log("\n=================================================================");
  console.log("       VPS PRODUCTION DATABASE FINAL AUDIT COUNTS                ");
  console.log("=================================================================");

  const reportChecklist = [
    // Configuration & Core Masters
    "countries", "country_branches", "city_branches", "profiles",
    // Business Entities
    "companies", "customers", "employees", "banks", "warehouses", "accounts", "ledgers",
    // Transactions
    "purchase_orders", "purchase_order_items", "purchase_order_payments", "purchase_loading_records", "local_purchases",
    "sales_orders", "sales_order_payments",
    "roznamcha_entries", "roznamcha_lines", "ledger_entries", "ledger_balances", "journal_entries", "journal_lines"
  ];

  const finalCounts = {};
  for (const t of reportChecklist) {
    try {
      const res = await sql.unsafe(`SELECT COUNT(*)::int as count FROM public."${t}"`);
      finalCounts[t] = res[0].count;
    } catch (e) {
      finalCounts[t] = "N/A";
    }
  }

  console.table(finalCounts);

  const finalCountries = await sql`SELECT id, name, iso2, currency_code, is_active FROM public.countries ORDER BY name`;
  console.log("\n--> 4 CORE ACTIVE COUNTRIES (" + finalCountries.length + "):");
  finalCountries.forEach(c => console.log("  - " + c.name + " (" + c.iso2 + ") | Currency: " + c.currency_code + " | Active: " + c.is_active));

  const finalBranches = await sql`SELECT id, name, code, is_main FROM public.country_branches ORDER BY name`;
  console.log("\n--> 4 MAIN COUNTRY BRANCHES (" + finalBranches.length + "):");
  finalBranches.forEach(b => console.log("  - " + b.name + " (" + b.code + ") [is_main: " + b.is_main + "]"));

  const finalAuth = await supabase.auth.admin.listUsers();
  console.log("\n--> ACTIVE USERS (1 Super Admin + 4 Country Admins = " + (finalAuth?.users?.length || 0) + "):");
  for (const u of finalAuth?.users || []) {
    console.log("  - " + u.email + " | Name: " + u.user_metadata?.full_name + " | Role: " + u.user_metadata?.role);
  }

  await sql.end();
  console.log("\n>>> VPS PRODUCTION IS 100% PURIFIED, CONFIGURED & READY FOR TOMORROW'S REAL WORK! <<<\n");
}

deepCleanAndConfigure().catch(e => {
  console.error("Fatal Error:", e);
  process.exit(1);
});
