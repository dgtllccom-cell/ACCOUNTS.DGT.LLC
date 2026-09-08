import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function run() {
  const users = await sql`SELECT id, email FROM auth.users`;
  const superAdminId = 'be3a6b15-65c5-4d74-82ae-e956c02a5f07';
  
  // Check foreign key references
  const tables = [
    'profiles', 'user_role_assignments', 'audit_logs', 'journal_entries', 
    'purchase_orders', 'sales_orders', 'customers', 'countries', 'warehouses'
  ];

  for (const t of tables) {
    try {
      const [{ count }] = await sql`SELECT count(*)::int as count FROM public.${sql(t)}`;
      console.log(`Table ${t}: ${count} rows`);
    } catch (e) {
      console.log(`Table ${t} error:`, e.message);
    }
  }

  // Check which users have any audit logs or entries
  const activeActors = await sql`SELECT DISTINCT actor_id FROM public.audit_logs WHERE actor_id IS NOT NULL`;
  console.log('Distinct actors in audit_logs:', activeActors);
  
  await sql.end();
}
run();
