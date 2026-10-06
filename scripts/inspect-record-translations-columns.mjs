import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const sql = postgres(resolveDbUrl("prod"), {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function run() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'record_translations'
  `;
  console.log("record_translations columns:", cols.map(c => c.column_name));
  await sql.end();
}

run().catch(console.error);
