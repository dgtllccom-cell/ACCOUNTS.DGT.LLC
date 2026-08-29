import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const localSql = postgres(resolveDbUrl("dev"), { ssl: { rejectUnauthorized: false }, prepare: false });
const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false }, prepare: false });

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
