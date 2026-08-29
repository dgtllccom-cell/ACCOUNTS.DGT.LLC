import postgres from 'postgres';
import fs from 'fs';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("==========================================================================");
    console.log("  APPLYING 4-LEVEL SERIAL ENGINE & CLEANING EMPLOYEES ON PRODUCTION");
    console.log("==========================================================================\n");

    // 1. Apply Migration
    console.log("Step 1: Applying 20260828_erp_wide_4level_serial_engine.sql on Production...");
    const migSql = fs.readFileSync('supabase/migrations/20260828_erp_wide_4level_serial_engine.sql', 'utf8');
    await sql.unsafe(migSql);
    console.log("✅ Migration applied successfully on Production DB!");

    // 2. Clear employees table per user's voice instruction (keep customers/persons intact)
    console.log("\nStep 2: Clearing employees table in Production (resetting to 0)...");
    
    // Check current count
    const [empCountBefore] = await sql`SELECT count(*)::int as count FROM public.employees`;
    console.log(`Employees count before reset: ${empCountBefore.count}`);

    // Delete employees records
    await sql`DELETE FROM public.employees;`;
    
    const [empCountAfter] = await sql`SELECT count(*)::int as count FROM public.employees`;
    console.log(`Employees count after reset: ${empCountAfter.count}`);

    // Verify customers table is untouched and intact
    const [custCount] = await sql`SELECT count(*)::int as count FROM public.customers WHERE deleted_at IS NULL`;
    console.log(`Customers / Persons count in Person Master (intact): ${custCount.count}`);

    console.log("\n==========================================================================");
    console.log("  PRODUCTION DATABASE READY & SERIAL SYSTEM ACTIVE!");
    console.log("==========================================================================");

  } catch (err) {
    console.error("Production script error:", err);
  } finally {
    await sql.end();
  }
}

main();
