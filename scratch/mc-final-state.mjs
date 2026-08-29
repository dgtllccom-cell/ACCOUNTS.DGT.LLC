import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("DALIAN ledger:", JSON.stringify((await sql`SELECT code,currency,current_balance FROM public.ledgers WHERE id='fd7a5f86-d45c-4c55-8685-e0c08b1b0909'`)[0]));
  console.log("PO AE-001-0022:", JSON.stringify((await sql`SELECT purchase_order_no, ledger_posting_status, status, advance_paid, remaining_due FROM public.purchase_orders WHERE id='1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e'`)[0]));
  console.log("job DI-2026-00001:", JSON.stringify((await sql`SELECT job_no, status, matched_source_id FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0]));
  console.log("stray MCREG ledgers:", (await sql`SELECT count(*)::int n FROM public.ledgers WHERE code LIKE 'MCREG-%'`)[0].n);
  console.log("stray MC test countries:", (await sql`SELECT count(*)::int n FROM public.countries WHERE name LIKE 'MC Testland%'`)[0].n);
  console.log("stray MCREG POs:", (await sql`SELECT count(*)::int n FROM public.purchase_orders WHERE purchase_contract_no LIKE 'MCREG-%'`)[0].n);
  console.log("active postings on AE-001-0022:", (await sql`SELECT count(*)::int n FROM public.purchase_order_payments WHERE purchase_order_id='1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e' AND deleted_at IS NULL AND status='posted'`)[0].n);
});
