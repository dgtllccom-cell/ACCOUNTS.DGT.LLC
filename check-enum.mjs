import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl);

async function checkEnum() {
  const types = await sql`SELECT typname FROM pg_type WHERE typname IN ('line_payment_type', 'payment_entry_type')`;
  console.log("Types found:", types);
  process.exit(0);
}

checkEnum().catch(console.error);
