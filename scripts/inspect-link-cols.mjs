import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectLinkCols() {
  const acCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'account_companies'`;
  console.log('account_companies columns:', acCols.map(c => c.column_name));
  await vpsSql.end();
}

inspectLinkCols().catch(console.error);
