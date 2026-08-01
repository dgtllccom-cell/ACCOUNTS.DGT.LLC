import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

async function applyMigrations() {
  console.log("Connecting to database...");
  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    const migDir = 'supabase/migrations';
    
    // We explicitly re-run 54, 55, and 56 to ensure the function signatures are fully updated
    // 0054: Modifies post_roznamcha_entry
    // 0055: Adds the 'boolean' argument to post_roznamcha_entry
    // 0056: Fixes the 'null' casting in post_purchase_order_payment
    const filesToRun = [
      '0054_post_roznamcha_generate_serials.sql',
      '0055_fix_cross_branch_roznamcha_posting.sql',
      '0056_multi_country_transaction_traceability.sql'
    ];
    
    for (const file of filesToRun) {
      console.log(`Executing migration: ${file}...`);
      const content = fs.readFileSync(path.join(migDir, file), 'utf8');
      await sql.unsafe(content);
      console.log(`✅ ${file} applied.`);
    }
    
    console.log("🎉 The database functions have been successfully updated!");
    console.log("Please click 'Transfer to Payment' again in the browser.");
    
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
  } finally {
    await sql.end();
  }
}

applyMigrations();
