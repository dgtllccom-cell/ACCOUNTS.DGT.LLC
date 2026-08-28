import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='ledgers' AND (column_name ILIKE '%type%' OR column_name ILIKE '%name%' OR column_name ILIKE '%category%' OR column_name ILIKE '%group%')`;
  console.log("ledger cols:", c.map(x=>x.column_name).join(", "));
  const l = await sql`SELECT id, ledger_name, account_type FROM public.ledgers WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f' LIMIT 8`.catch(async () => {
    return await sql`SELECT * FROM public.ledgers WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f' LIMIT 2`;
  });
  console.log(JSON.stringify(l).slice(0,800));
});
process.exit(0);
