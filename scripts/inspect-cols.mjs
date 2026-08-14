import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectCols() {
  const accCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`;
  console.log('Accounts columns:', accCols.map(c => c.column_name));

  const stockCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements'`;
  console.log('Stock Movements columns:', stockCols.map(c => c.column_name));

  const coCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'`;
  console.log('Companies columns:', coCols.map(c => c.column_name));

  await vpsSql.end();
}

inspectCols().catch(console.error);
