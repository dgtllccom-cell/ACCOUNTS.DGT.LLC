import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const CID = "dbc71061-0c11-4532-82e7-dcac033180b7";
  const tbls = await sql`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='countries' AND ccu.column_name='id'`;
  for (const t of tbls) {
    try { const r = await sql.unsafe(`DELETE FROM public.${t.table_name} WHERE ${t.column_name}=$1`, [CID]); }
    catch(e){ console.log("skip", t.table_name, e.message.slice(0,60)); }
  }
  await sql`DELETE FROM public.ledgers WHERE country_id=${CID}`.catch(e=>console.log("ledgers",e.message.slice(0,60)));
  await sql`DELETE FROM public.countries WHERE id=${CID}`;
  console.log("nuked ZZ country");
  console.log("remaining MC:", JSON.stringify(await sql`SELECT id,name FROM public.countries WHERE name LIKE 'MC Testland%'`));
});
