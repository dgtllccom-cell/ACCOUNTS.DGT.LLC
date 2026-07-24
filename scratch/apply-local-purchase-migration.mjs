import fs from 'fs';
import postgres from 'postgres';
import dotenv from 'dotenv';

// Load .env.local variables
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local!");
  process.exit(1);
}

async function applyMigration() {
  console.log("Connecting to database...");
  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    const sqlText = fs.readFileSync('supabase/migrations/0076_local_purchases.sql', 'utf8');
    
    console.log("Executing SQL migration 0076...");
    await sql.unsafe(sqlText);
    
    console.log("✅ Migration 0076 applied successfully!");
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
  } finally {
    await sql.end();
  }
}

applyMigration();
