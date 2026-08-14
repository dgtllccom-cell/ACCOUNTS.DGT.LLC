import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectLinkCols() {
  const acCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'account_companies'`;
  console.log('account_companies columns:', acCols.map(c => c.column_name));
  await vpsSql.end();
}

inspectLinkCols().catch(console.error);
