import { withLocalPg } from "./lib/db/local-postgres.js";

async function main() {
  const res = await withLocalPg((sql) => sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'roznamcha_entries' 
      AND column_name IN ('entry_date', 'created_at')
  `);
  console.log("roznamcha_entries columns:", res);
  process.exit(0);
}
main().catch(console.error);
