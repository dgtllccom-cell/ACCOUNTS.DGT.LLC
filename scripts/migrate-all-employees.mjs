import postgres from 'postgres';

const localSql = postgres('postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });
const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function migrateAllEmployees() {
  const localCbs = await localSql`SELECT id, country_id, code FROM country_branches`;
  const vpsCbs = await vpsSql`SELECT id, country_id, code FROM country_branches`;
  const vpsCtbs = await vpsSql`SELECT id, city_id, code FROM city_branches`;

  const cbMap = new Map();
  for (const lcb of localCbs) {
    const matched = vpsCbs.find(v => (v.country_id === lcb.country_id && v.code?.toUpperCase() === lcb.code?.toUpperCase()) || (v.code?.toUpperCase() === lcb.code?.toUpperCase()));
    if (matched) {
      cbMap.set(lcb.id, matched.id);
    }
  }

  const localEmployees = await localSql`SELECT * FROM employees`;
  let inserted = 0;
  for (const emp of localEmployees) {
    const mappedEmp = { ...emp };
    if (emp.country_branch_id && cbMap.has(emp.country_branch_id)) {
      mappedEmp.country_branch_id = cbMap.get(emp.country_branch_id);
    } else if (emp.country_branch_id && !vpsCbs.some(v => v.id === emp.country_branch_id)) {
      const defaultCb = vpsCbs.find(v => v.country_id === emp.country_id) || vpsCbs[0];
      mappedEmp.country_branch_id = defaultCb ? defaultCb.id : null;
    }

    if (emp.city_branch_id && !vpsCtbs.some(v => v.id === emp.city_branch_id)) {
      mappedEmp.city_branch_id = null;
    }

    try {
      await vpsSql`
        INSERT INTO employees ${vpsSql(mappedEmp)}
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (e) {
      console.log('Employee migrate error:', emp.id, emp.employee_code, e.message);
    }
  }

  const [finalEmp] = await vpsSql`SELECT count(*) FROM employees`;
  console.log(`Employees synced: ${inserted}/${localEmployees.length}. Final VPS count: ${finalEmp.count}`);

  await localSql.end();
  await vpsSql.end();
}

migrateAllEmployees().catch(console.error);
