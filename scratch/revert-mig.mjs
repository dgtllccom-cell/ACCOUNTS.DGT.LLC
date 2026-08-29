import { withLocalPg } from "@/lib/db/local-postgres";
import fs from "node:fs";
// restore the ORIGINAL function body (captured before the migration)
const orig = fs.readFileSync("scratch/post_purchase_order_payment.sql","utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(orig);
  await sql`DELETE FROM public.erp_schema_migrations WHERE name='20260831_fix_purchase_payment_exchange_rate_column'`;
  // reverse the advance test payment + its roznamcha entry
  const adv = (await sql`SELECT id, roznamcha_entry_id FROM public.purchase_order_payments WHERE purchase_order_id='1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e' AND kind='advance'`)[0];
  if (adv) {
    await sql`SELECT reverse_roznamcha_entry(${adv.roznamcha_entry_id}::uuid, 'UAT cleanup — revert exchange-rate migration test', NULL::uuid)`.catch(e=>console.log("reverse note:", e.message));
    await sql`UPDATE public.purchase_order_payments SET deleted_at=now(), status='cancelled' WHERE id=${adv.id}`;
    await sql`SELECT recalc_purchase_order_payment_totals('1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e'::uuid)`;
  }
  const po=(await sql`SELECT order_total, advance_paid, remaining_due, payment_status, ledger_posting_status FROM public.purchase_orders WHERE id='1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e'`)[0];
  console.log("PO after cleanup:", JSON.stringify(po));
  const fn=(await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_purchase_order_payment'`)[0].d;
  console.log("function has old CASE:", fn.includes("when v_currency = upper(trim(coalesce(v_order.currency_code"));
});
