import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const localSql = postgres(resolveDbUrl("dev"), { ssl: { rejectUnauthorized: false }, prepare: false });
const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false }, prepare: false });

async function syncBranchesAndEmployees() {
  // 1. Sync country_branches
  const localCb = await localSql`SELECT * FROM country_branches`;
  console.log('Local country_branches:', localCb.length);
  for (const cb of localCb) {
    await vpsSql`INSERT INTO country_branches ${vpsSql(cb)} ON CONFLICT (id) DO NOTHING`;
  }

  // 2. Sync city_branches
  const localCityB = await localSql`SELECT * FROM city_branches`;
  console.log('Local city_branches:', localCityB.length);
  for (const ctb of localCityB) {
    await vpsSql`INSERT INTO city_branches ${vpsSql(ctb)} ON CONFLICT (id) DO NOTHING`;
  }

  // 3. Sync employees
  const localEmp = await localSql`SELECT * FROM employees`;
  console.log('Local employees:', localEmp.length);
  let empInserted = 0;
  for (const emp of localEmp) {
    try {
      await vpsSql`INSERT INTO employees ${vpsSql(emp)} ON CONFLICT (id) DO NOTHING`;
      empInserted++;
    } catch (e) {
      console.log('Emp err:', emp.id, e.message);
    }
  }

  // 4. Sync customer_registrations
  const localRegs = await localSql`SELECT * FROM customer_registrations`;
  console.log('Local customer_registrations:', localRegs.length);
  for (const reg of localRegs) {
    try {
      await vpsSql`INSERT INTO customer_registrations ${vpsSql(reg)} ON CONFLICT (id) DO NOTHING`;
    } catch (e) {
      console.log('Reg err:', reg.id, e.message);
    }
  }

  const [finalEmp] = await vpsSql`SELECT count(*) FROM employees`;
  const [finalCb] = await vpsSql`SELECT count(*) FROM country_branches`;
  const [finalCtb] = await vpsSql`SELECT count(*) FROM city_branches`;
  const [finalRegs] = await vpsSql`SELECT count(*) FROM customer_registrations`;

  console.log('Final VPS Counts:', {
    country_branches: finalCb.count,
    city_branches: finalCtb.count,
    employees: finalEmp.count,
    customer_registrations: finalRegs.count
  });

  await localSql.end();
  await vpsSql.end();
}

syncBranchesAndEmployees().catch(console.error);
