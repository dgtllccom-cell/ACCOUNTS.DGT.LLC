import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const poId="1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e";
  console.log("roznamcha status enum:", (await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='roznamcha_status'`).map(r=>r.enumlabel).join(","));
  const entries = await sql`SELECT id, voucher_no, status, base_currency_amount, source_transaction_type, reversed_by, reversal_of FROM public.roznamcha_entries WHERE source_transaction_id=${poId} AND source_module='purchase' ORDER BY created_at`.catch(async()=>
    sql`SELECT id, voucher_no, status, base_currency_amount, source_transaction_type FROM public.roznamcha_entries WHERE source_transaction_id=${poId} AND source_module='purchase' ORDER BY created_at`);
  for (const e of entries) console.log(JSON.stringify(e));
  const pp = await sql`SELECT kind, status, deleted_at IS NOT NULL AS deleted, amount, base_currency_amount FROM public.purchase_order_payments WHERE purchase_order_id=${poId}`;
  for (const p of pp) console.log("payment:", JSON.stringify(p));
  const po=(await sql`SELECT purchase_order_no, ledger_posting_status, status, advance_paid, remaining_due FROM public.purchase_orders WHERE id=${poId}`)[0];
  console.log("PO:", JSON.stringify(po));
});
