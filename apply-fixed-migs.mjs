import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function applyMigrations() {
  console.log("Connecting to database...");
  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    const migDir = 'supabase/migrations';
    const filesToRun = [
      '0075_payment_posting_workflow_fixes.sql'
    ];
    
    for (const file of filesToRun) {
      console.log(`Executing migration: ${file}...`);
      const content = fs.readFileSync(path.join(migDir, file), 'utf8');
      await sql.unsafe(content);
      console.log(`✅ ${file} applied.`);
    }
    
    console.log("🎉 Database functions have been successfully updated!");
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
  } finally {
    await sql.end();
  }
}

applyMigrations();
