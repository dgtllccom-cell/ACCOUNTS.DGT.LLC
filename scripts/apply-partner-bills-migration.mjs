import postgres from 'postgres';
import fs from 'fs';

const dbUrl = process.env.DATABASE_URL;
console.log('Connecting to database:', dbUrl?.replace(/:[^:@]+@/, ':***@'));

if (!dbUrl || !dbUrl.includes('csesvyxxjivnkkozgopt')) {
  console.error('FATAL: Not connected to dedicated DEV database (csesvyxxjivnkkozgopt)! Aborting.');
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

async function run() {
  const migrationSql = fs.readFileSync('supabase/migrations/20261212_customer_order_external_partner_bills.sql', 'utf8');
  console.log('Applying 20261212_customer_order_external_partner_bills.sql to DEV database...');
  await sql.unsafe(migrationSql);
  console.log('✓ Migration applied successfully to DEV database!');
  await sql.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
