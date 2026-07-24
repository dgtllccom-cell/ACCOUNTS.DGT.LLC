import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  try {
    const result = await sql`SELECT count(*) as companies FROM public.companies;`;
    console.log("QUERY RESULT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Query Error:", err.message);
  } finally {
    await sql.end();
  }
}

main();
