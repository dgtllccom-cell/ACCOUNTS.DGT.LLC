import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectCols() {
  const bCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'banks'`;
  console.log('banks cols:', bCols.map(c => c.column_name));

  const wCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouses'`;
  console.log('warehouses cols:', wCols.map(c => c.column_name));

  const cCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'customers'`;
  console.log('customers cols:', cCols.map(c => c.column_name));

  await vpsSql.end();
}

inspectCols().catch(console.error);
