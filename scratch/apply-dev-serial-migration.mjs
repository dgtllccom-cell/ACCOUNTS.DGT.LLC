import postgres from 'postgres';
import fs from 'fs';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("=== APPLYING 4-LEVEL SERIAL ENGINE ON DEV DATABASE ===");
    const migSql = fs.readFileSync('supabase/migrations/20260828_erp_wide_4level_serial_engine.sql', 'utf8');
    
    await sql.unsafe(migSql);
    console.log("✅ Migration 20260828_erp_wide_4level_serial_engine applied successfully to DEV!");

    // Test allocate_4level_serials RPC on DEV
    console.log("\n=== TESTING RPC allocate_4level_serials ON DEV ===");
    const test1 = await sql`SELECT allocate_4level_serials('account', '582526d0-0375-41e9-8eba-ccbd2a5e3a0f', '18580e4e-6a12-407d-9332-007a959e89b3', 'ACC') as serials`;
    console.log("Account (Dubai Branch) Test 1:", JSON.stringify(test1[0].serials, null, 2));

    const test2 = await sql`SELECT allocate_4level_serials('account', '582526d0-0375-41e9-8eba-ccbd2a5e3a0f', '18580e4e-6a12-407d-9332-007a959e89b3', 'ACC') as serials`;
    console.log("Account (Dubai Branch) Test 2 (sequential):", JSON.stringify(test2[0].serials, null, 2));

    const test3 = await sql`SELECT allocate_4level_serials('purchase', 'ace69ef9-8c3b-479c-bdb7-7953ddf8629d', '012c9036-f9ef-4cbc-a7cb-0763fad8e5b1', 'PUR') as serials`;
    console.log("Purchase (Karachi Branch) Test 1:", JSON.stringify(test3[0].serials, null, 2));

  } catch (err) {
    console.error("Error applying to DEV:", err);
  } finally {
    await sql.end();
  }
}

main();
