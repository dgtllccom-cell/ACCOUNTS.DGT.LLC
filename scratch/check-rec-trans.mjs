import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'record_translations'
      ORDER BY ordinal_position;
    `;
    console.table(cols);

    const count = await sql`SELECT count(*) FROM public.record_translations`;
    console.log("Total record_translations count:", count[0].count);

    const sample = await sql`SELECT * FROM public.record_translations LIMIT 5`;
    console.log("Sample:", sample);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
