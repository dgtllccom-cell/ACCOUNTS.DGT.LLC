import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from "postgres";

const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function checkTransIndexes() {
  const indexes = await vpsSql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'record_translations';
  `;
  console.log("Indexes on record_translations:", indexes);
  await vpsSql.end();
  process.exit(0);
}

checkTransIndexes();
