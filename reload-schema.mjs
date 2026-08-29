import { resolveDbUrl } from "./scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const dbUrl = resolveDbUrl("dev");
const sql = postgres(dbUrl);

async function reloadSchema() {
  console.log("Reloading PostgREST schema cache...");
  await sql`NOTIFY pgrst, 'reload schema'`;
  console.log("Schema cache reloaded!");
  process.exit(0);
}

reloadSchema().catch(console.error);
