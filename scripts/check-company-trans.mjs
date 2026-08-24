import postgres from 'postgres';

const url = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const sql = postgres(url, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });
  try {
    const companies = await sql`select * from public.companies where deleted_at is null`;
    console.log('Companies in DB:\n', JSON.stringify(companies, null, 2));

    const trans = await sql`select * from public.record_translations where record_table = 'companies'`;
    console.log('Company record translations:\n', JSON.stringify(trans, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
