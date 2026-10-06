import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectEmpCols() {
  const eCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'`;
  console.log('employees cols:', eCols.map(c => c.column_name));
  await vpsSql.end();
}

inspectEmpCols().catch(console.error);
