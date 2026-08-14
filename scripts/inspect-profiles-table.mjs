import postgres from 'postgres';

const sql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function inspectProfiles() {
  const profileCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles'
  `;
  console.log("Profiles columns:", profileCols.map(c => c.column_name));

  const uraCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'user_role_assignments'
  `;
  console.log("user_role_assignments columns:", uraCols.map(c => c.column_name));

  await sql.end();
}

inspectProfiles().catch(console.error);
