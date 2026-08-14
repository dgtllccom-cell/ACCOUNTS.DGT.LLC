import postgres from 'postgres';

const localSql = postgres('postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });
const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectEmployees() {
  const localEmp = await localSql`SELECT * FROM employees`;
  console.log('Local employees count:', localEmp.length);
  
  const vpsEmp = await vpsSql`SELECT * FROM employees`;
  console.log('VPS employees count:', vpsEmp.length);

  // Try migrating the missing employees to VPS
  let inserted = 0;
  for (const emp of localEmp) {
    try {
      await vpsSql`
        INSERT INTO employees ${vpsSql(emp)}
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      console.log('Insert error for emp:', emp.id, err.message);
    }
  }

  console.log('Inserted employees to VPS:', inserted);
  const [finalVps] = await vpsSql`SELECT count(*) FROM employees`;
  console.log('Final VPS employees count:', finalVps.count);

  await localSql.end();
  await vpsSql.end();
}

inspectEmployees().catch(console.error);
