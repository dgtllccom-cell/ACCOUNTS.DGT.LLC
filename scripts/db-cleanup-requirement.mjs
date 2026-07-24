import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const confirmFlag = "--confirm-cleanup";
if (!process.argv.includes(confirmFlag)) {
  console.error(`Refusing to run cleanup without ${confirmFlag}`);
  process.exit(1);
}

// 1. Read environment variables from .env.local
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("Supabase config (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY) not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runCleanup() {
  console.log("Starting requirement-based database cleanup...");

  try {
    // A. Identify China country record (code = CN, name = chain/china)
    const countries = await sql`SELECT id, name, iso2 FROM public.countries WHERE deleted_at IS NULL`;
    console.log(`Found ${countries.length} countries in database.`);
    
    const chinaCountry = countries.find(
      (c) => c.iso2?.toUpperCase() === "CN" || c.name?.toLowerCase() === "chain" || c.name?.toLowerCase() === "china"
    );

    let chinaCountryId = null;
    if (chinaCountry) {
      chinaCountryId = chinaCountry.id;
      console.log(`China country identified: ${chinaCountry.name} (ID: ${chinaCountryId})`);
    } else {
      console.log("China country not identified in database, skipping China-specific cascade deletions.");
    }

    // B. Keep one admin user per country, delete all other users.
    // Query active roles and assignments
    const assignments = await sql`
      SELECT id, user_id, role, country_id, country_branch_id, city_branch_id 
      FROM public.user_role_assignments 
      WHERE is_active = true AND deleted_at IS NULL
    `;
    console.log(`Loaded ${assignments.length} role assignments.`);

    const preservedUserIds = new Set();
    const otherCountries = countries.filter((c) => c.id !== chinaCountryId);
    
    console.log("Selecting Admin users to preserve for each country...");
    for (const country of otherCountries) {
      // Find all assignments matching this country
      const countryAssignments = assignments.filter((a) => a.country_id === country.id);
      
      // Look for a country_admin or super_admin or branch_admin
      let admin = countryAssignments.find((a) => a.role === "super_admin");
      if (!admin) admin = countryAssignments.find((a) => a.role === "country_admin");
      if (!admin) admin = countryAssignments.find((a) => a.role === "main_branch_admin");
      if (!admin) admin = countryAssignments.find((a) => a.role === "city_branch_admin");
      if (!admin) admin = countryAssignments[0]; // fallback to any user if no admin role matches
      
      if (admin) {
        preservedUserIds.add(admin.user_id);
        console.log(`Preserving Admin user for ${country.name}: User ID ${admin.user_id} (Role: ${admin.role})`);
      } else {
        console.log(`Warning: No active users/assignments found for country ${country.name}`);
      }
    }

    // Also preserve all global super_admins (who don't have a country assigned)
    const globalSuperAdmins = assignments.filter((a) => a.role === "super_admin" && !a.country_id);
    for (const admin of globalSuperAdmins) {
      preservedUserIds.add(admin.user_id);
      console.log(`Preserving global Super Admin: User ID ${admin.user_id}`);
    }

    // Identify users to delete
    const allProfiles = await sql`SELECT id, full_name FROM public.profiles`;
    const toDeleteUsers = allProfiles.filter((p) => !preservedUserIds.has(p.id));
    console.log(`Found ${toDeleteUsers.length} users to delete.`);

    // Disable default branch pointers in countries before deleting branches
    await sql`UPDATE public.countries SET default_country_branch_id = NULL`;

    // C. Perform deletes
    await sql.begin(async (tx) => {
      // 1. Delete transactional records across ALL countries
      const transactionalTables = [
        "ledger_transaction_audit_trail",
        "inter_branch_ledger_transfers",
        "purchase_loading_records",
        "shipping_bl_records",
        "purchase_order_payments",
        "purchase_orders",
        "sales_order_payments",
        "sales_orders",
        "shipping_line_records",
        "shipment_documents",
        "roznamcha_reversals",
        "ledger_entries",
        "journal_lines",
        "journal_entries",
        "ledger_balances",
        "ledger_posting_lines",
        "roznamcha_lines",
        "roznamcha_entries",
        "enterprise_ledger_reversals",
        "ledger_opening_balances",
        "ledger_posting_batches",
        "enterprise_account_history",
        "daily_usd_rates",
        "usd_purchase_sales",
        "exchange_rate_history",
        "approval_status_history",
        "approval_request_items",
        "approval_requests",
        "record_locks",
        "record_change_history",
        "soft_delete_logs",
        "attachments",
        "audit_logs",
        "erp_activity_events",
        "erp_record_transfers",
        "erp_pdf_email_jobs",
        "erp_assignments",
        "product_inventory_balances",
        "customer_contacts",
        "customer_registrations",
        "customers",
        "ledgers",
        "accounts",
        "enterprise_accounts"
      ];

      for (const table of transactionalTables) {
        const [row] = await tx`SELECT to_regclass(${`public.${table}`}) as tbl`;
        if (row.tbl) {
          console.log(`Clearing table public.${table}...`);
          await tx.unsafe(`TRUNCATE TABLE public."${table}" RESTART IDENTITY CASCADE`);
        }
      }

      // 2. Delete China branch structure (if China was identified)
      if (chinaCountryId) {
        console.log("Deleting China branches, city branches, and assignments...");
        await tx`DELETE FROM public.user_role_assignments WHERE country_id = ${chinaCountryId}`;
        await tx`DELETE FROM public.city_branches WHERE country_id = ${chinaCountryId}`;
        await tx`DELETE FROM public.country_branches WHERE country_id = ${chinaCountryId}`;
        await tx`DELETE FROM public.countries WHERE id = ${chinaCountryId}`;
      }

      // 3. Delete non-preserved users from database tables
      const deletedUserIds = toDeleteUsers.map((u) => u.id);
      if (deletedUserIds.length) {
        console.log("Deleting non-preserved user role assignments and profiles...");
        await tx`DELETE FROM public.user_permission_sets WHERE user_id IN ${tx(deletedUserIds)}`;
        await tx`DELETE FROM public.user_role_assignments WHERE user_id IN ${tx(deletedUserIds)}`;
        await tx`DELETE FROM public.profiles WHERE id IN ${tx(deletedUserIds)}`;
      }
    });

    console.log("Database transaction completed successfully.");

    // D. Delete non-preserved users from Supabase Auth
    console.log("Deleting non-preserved users from Supabase Auth...");
    for (const user of toDeleteUsers) {
      console.log(`Auth delete: User ID ${user.id} (${user.full_name})`);
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`Supabase Auth delete failed for ${user.id}: ${error.message}`);
      } else {
        console.log(`Auth delete succeeded for ${user.id}`);
      }
    }

    console.log("Cleanup process completed successfully!");
  } catch (error) {
    console.error("Cleanup error encountered:", error);
  } finally {
    await sql.end();
  }
}

runCleanup();
