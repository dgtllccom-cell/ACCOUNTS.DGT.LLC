import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false }, prepare: false });

async function inspectTransCols() {
  const transCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'record_translations'`;
  console.log('record_translations columns:', transCols.map(c => c.column_name));
  await vpsSql.end();
}

inspectTransCols().catch(console.error);
