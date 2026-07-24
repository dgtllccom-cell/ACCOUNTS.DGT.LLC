import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function reloadSchema() {
  console.log("Reloading PostgREST schema cache...");
  await sql`NOTIFY pgrst, 'reload schema'`;
  console.log("Schema cache reloaded!");
  process.exit(0);
}

reloadSchema().catch(console.error);
