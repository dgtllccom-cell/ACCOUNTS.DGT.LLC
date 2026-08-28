import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='employees' AND (column_name ILIKE '%ledger%' OR column_name ILIKE '%account%' OR column_name ILIKE '%payable%' OR column_name ILIKE '%expense%')`;
  console.log("employee ledger cols:", c.map(x=>x.column_name).join(", "));
  const led = await sql`SELECT id, name, ledger_type, country_id FROM public.ledgers WHERE deleted_at IS NULL AND country_id = '935dd0b9-8228-43b3-b53d-c06e9ae2882f' LIMIT 10`;
  console.log("UAE ledgers:", JSON.stringify(led.map(l=>({id:l.id.slice(0,8), name:l.name, type:l.ledger_type}))));
});
process.exit(0);
