import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const cs = await sql`SELECT id, name, iso2 FROM public.countries WHERE name LIKE 'MC Testland%' OR iso2='ZZ'`;
  console.log("stale test countries:", JSON.stringify(cs));
  for (const c of cs) {
    await sql`DELETE FROM public.roznamcha_lines l USING public.roznamcha_entries e WHERE l.roznamcha_entry_id=e.id AND e.country_id=${c.id}`.catch(()=>{});
    await sql`DELETE FROM public.roznamcha_entries WHERE country_id=${c.id}`.catch(()=>{});
    await sql`DELETE FROM public.purchase_order_payments p USING public.purchase_orders o WHERE p.purchase_order_id=o.id AND o.country_id=${c.id}`.catch(()=>{});
    await sql`DELETE FROM public.purchase_orders WHERE country_id=${c.id}`.catch(()=>{});
    await sql`DELETE FROM public.ledger_balances lb USING public.ledgers g WHERE lb.ledger_id=g.id AND g.country_id=${c.id}`.catch(()=>{});
    await sql`DELETE FROM public.ledgers WHERE country_id=${c.id}`.catch(()=>{});
    await sql`DELETE FROM public.countries WHERE id=${c.id}`;
  }
  // also stale MCREG ledgers under real countries
  await sql`DELETE FROM public.ledger_balances lb USING public.ledgers g WHERE lb.ledger_id=g.id AND g.code LIKE 'MCREG-%'`.catch(()=>{});
  await sql`DELETE FROM public.roznamcha_lines l USING public.roznamcha_entries e WHERE l.roznamcha_entry_id=e.id AND (e.reference_no LIKE 'MCREG-%' OR e.narration LIKE '%MCREG-%')`.catch(()=>{});
  await sql`DELETE FROM public.roznamcha_entries WHERE reference_no LIKE 'MCREG-%' OR narration LIKE '%MCREG-%'`.catch(()=>{});
  await sql`DELETE FROM public.purchase_order_payments p USING public.purchase_orders o WHERE p.purchase_order_id=o.id AND o.purchase_contract_no LIKE 'MCREG-%'`.catch(()=>{});
  await sql`DELETE FROM public.purchase_orders WHERE purchase_contract_no LIKE 'MCREG-%'`.catch(()=>{});
  await sql`DELETE FROM public.ledgers WHERE code LIKE 'MCREG-%'`.catch(()=>{});
  console.log("cleaned");
});
