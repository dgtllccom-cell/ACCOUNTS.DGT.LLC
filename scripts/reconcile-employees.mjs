import postgres from 'postgres';

const localSql = postgres('postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });
const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false }, prepare: false });

async function reconcileAndMigrateEmployees() {
  const localCbs = await localSql`SELECT * FROM country_branches`;
  const vpsCbs = await vpsSql`SELECT * FROM country_branches`;

  console.log('Local country_branches:', localCbs.map(c => ({ id: c.id, code: c.code, country_id: c.country_id })));
  console.log('VPS country_branches:', vpsCbs.map(c => ({ id: c.id, code: c.code, country_id: c.country_id })));

  const cbMap = new Map();
  for (const lcb of localCbs) {
    const matched = vpsCbs.find(v => (v.country_id === lcb.country_id && v.code?.toUpperCase() === lcb.code?.toUpperCase()) || (v.code?.toUpperCase() === lcb.code?.toUpperCase()));
    if (matched) {
      cbMap.set(lcb.id, matched.id);
    }
  }

  const localEmployees = await localSql`SELECT * FROM employees`;
  console.log('Total Local Employees:', localEmployees.length);

  let inserted = 0;
  for (const emp of localEmployees) {
    const mappedEmp = { ...emp };
    if (emp.country_branch_id && cbMap.has(emp.country_branch_id)) {
      mappedEmp.country_branch_id = cbMap.get(emp.country_branch_id);
    } else if (emp.country_branch_id && !vpsCbs.some(v => v.id === emp.country_branch_id)) {
      const defaultCb = vpsCbs.find(v => v.country_id === emp.country_id) || vpsCbs[0];
      mappedEmp.country_branch_id = defaultCb ? defaultCb.id : null;
    }

    try {
      await vpsSql`
        INSERT INTO employees ${vpsSql(mappedEmp)}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          employee_code = EXCLUDED.employee_code,
          country_id = EXCLUDED.country_id,
          country_branch_id = EXCLUDED.country_branch_id,
          city_branch_id = EXCLUDED.city_branch_id,
          department = EXCLUDED.department,
          designation = EXCLUDED.designation,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          salary = EXCLUDED.salary,
          status = EXCLUDED.status
      `;
      inserted++;
    } catch (e) {
      console.log('Employee migrate error:', emp.id, emp.name, e.message);
    }
  }

  console.log(`Employees reconciled and migrated: ${inserted}/${localEmployees.length}`);
  const [finalEmp] = await vpsSql`SELECT count(*) FROM employees`;
  console.log('Final VPS Employees Count:', finalEmp.count);

  await localSql.end();
  await vpsSql.end();
}

reconcileAndMigrateEmployees().catch(console.error);
