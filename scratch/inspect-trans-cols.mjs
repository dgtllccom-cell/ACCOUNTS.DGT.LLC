import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const cols = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name LIKE '%translat%'
      ORDER BY table_name, ordinal_position;
    `;
    console.table(cols);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
