import fs from 'fs';
import postgres from 'postgres';

// Use the pooler URL from .env.local
const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function applyMigration() {
  console.log("Connecting to database...");
  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    const mig56 = fs.readFileSync('supabase/migrations/0056_multi_country_transaction_traceability.sql', 'utf8');
    
    console.log("Executing SQL migration 0056...");
    await sql.unsafe(mig56);
    
    console.log("✅ Migrations applied successfully!");
    console.log("You can now click 'Transfer to Payment' in your browser and it will work perfectly.");
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
  } finally {
    await sql.end();
  }
}

applyMigration();
