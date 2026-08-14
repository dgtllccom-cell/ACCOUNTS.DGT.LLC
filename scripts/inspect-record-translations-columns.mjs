import postgres from 'postgres';

const sql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function run() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'record_translations'
  `;
  console.log("record_translations columns:", cols.map(c => c.column_name));
  await sql.end();
}

run().catch(console.error);
