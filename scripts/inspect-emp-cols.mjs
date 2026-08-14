import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectEmpCols() {
  const eCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'`;
  console.log('employees cols:', eCols.map(c => c.column_name));
  await vpsSql.end();
}

inspectEmpCols().catch(console.error);
