import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const l = await sql`SELECT id, name, code, normal_balance, currency FROM public.ledgers WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f' AND scope='country' ORDER BY name`;
  for (const x of l) console.log(`${x.normal_balance.padEnd(7)} ${x.currency} ${x.name}  [${x.code}] ${x.id}`);
});
process.exit(0);
