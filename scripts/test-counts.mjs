import postgres from 'postgres';

const localSql = postgres('postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: { rejectUnauthorized: false } });
const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false } });

async function test() {
  const localRows = await localSql`SELECT * FROM states_provinces`;
  console.log('Local states_provinces count:', localRows.length);
  const vpsRows = await vpsSql`SELECT count(*) FROM states_provinces`;
  console.log('VPS states_provinces count:', vpsRows[0].count);

  const localDistricts = await localSql`SELECT count(*) FROM districts`;
  console.log('Local districts count:', localDistricts[0].count);
  const vpsDistricts = await vpsSql`SELECT count(*) FROM districts`;
  console.log('VPS districts count:', vpsDistricts[0].count);

  await localSql.end();
  await vpsSql.end();
}

test().catch(console.error);
