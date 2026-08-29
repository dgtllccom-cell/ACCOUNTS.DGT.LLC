import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsEnv = { DATABASE_URL: resolveDbUrl("prod") };
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 5, ssl: { rejectUnauthorized: false } });

async function main() {
  const cols = await vpsSql`
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'roznamcha_entries' AND column_name IN ('created_by', 'approved_by')
  `;
  console.log('roznamcha_entries nullable columns:', cols);
  await vpsSql.end();
}

main().catch(console.error);
