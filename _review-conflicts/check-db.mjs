import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function checkDb() {
  console.log("Checking migrations...");
  const migrations = await sql`
    SELECT name, status, applied_at FROM erp_schema_migrations ORDER BY name DESC LIMIT 10
  `;
  console.log("Recent migrations:");
  console.table(migrations);

  console.log("\nChecking post_roznamcha_entry signatures...");
  const funcs = await sql`
    SELECT pg_get_function_identity_arguments(p.oid) as signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'post_roznamcha_entry'
  `;
  console.log("Available signatures:");
  for (const f of funcs) {
    console.log(f.signature);
  }
  
  process.exit(0);
}

checkDb().catch(console.error);
