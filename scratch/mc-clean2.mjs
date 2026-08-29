import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const lg = await sql`SELECT id, code, current_balance FROM public.ledgers WHERE code LIKE 'MCREG-%'`;
  console.log("orphan MCREG ledgers:", JSON.stringify(lg));
  for (const l of lg) {
    await sql`DELETE FROM public.roznamcha_lines WHERE ledger_id=${l.id}`.catch(e=>console.log(" rl",e.message.slice(0,50)));
    await sql`DELETE FROM public.ledger_balances WHERE ledger_id=${l.id}`.catch(()=>{});
    await sql`DELETE FROM public.ledgers WHERE id=${l.id}`.catch(e=>console.log(" l",e.message.slice(0,50)));
  }
  await sql`DELETE FROM public.roznamcha_entries WHERE reference_no LIKE 'MCREG-%' OR narration LIKE '%MCREG-%'`.catch(e=>console.log("re",e.message.slice(0,50)));
  await sql`DELETE FROM public.purchase_orders WHERE purchase_contract_no LIKE 'MCREG-%'`.catch(e=>console.log("po",e.message.slice(0,50)));
  console.log("done. MCREG ledgers left:", (await sql`SELECT count(*)::int n FROM public.ledgers WHERE code LIKE 'MCREG-%'`)[0].n);
});
