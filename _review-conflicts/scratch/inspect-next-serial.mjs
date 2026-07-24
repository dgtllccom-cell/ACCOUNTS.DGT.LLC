import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function inspect() {
  console.log("Checking next_entity_serial signatures...");
  const funcs = await sql`
    SELECT pg_get_function_identity_arguments(p.oid) as signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'next_entity_serial'
  `;
  console.log("Available signatures:");
  for (const f of funcs) {
    console.log(f.signature);
  }
  
  process.exit(0);
}

inspect().catch(console.error);
