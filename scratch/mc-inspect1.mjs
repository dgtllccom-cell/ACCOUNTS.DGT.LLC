import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const cols = async (t) => (await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`).map(c=>`${c.column_name}:${c.data_type}`);
  console.log("### purchase_order_payments\n", (await cols('purchase_order_payments')).join("\n "));
  console.log("\n### ledgers\n", (await cols('ledgers')).join("\n "));

  console.log("\n### HISTORICAL purchase_order_payments — currency conventions (last 25) ###");
  const pp = await sql`
    SELECT p.kind, p.amount, p.currency_code, p.exchange_rate, p.base_currency_amount, p.original_currency_code, p.currency_name,
           o.purchase_currency, o.payment_currency, o.currency_code AS o_ccy, o.exchange_rate AS o_rate, o.order_total,
           dl.currency AS dr_ccy, cl.currency AS cr_ccy
    FROM public.purchase_order_payments p
    JOIN public.purchase_orders o ON o.id=p.purchase_order_id
    LEFT JOIN public.ledgers dl ON dl.id=p.debit_ledger_id
    LEFT JOIN public.ledgers cl ON cl.id=p.credit_ledger_id
    WHERE p.deleted_at IS NULL
    ORDER BY p.created_at DESC LIMIT 25`;
  for (const r of pp) console.log(` ${r.kind.padEnd(9)} amt=${r.amount} ccy=${r.currency_code} xr=${r.exchange_rate} base=${r.base_currency_amount} orig=${r.original_currency_code} | PO pur/pay/ccy/rate=${r.purchase_currency}/${r.payment_currency}/${r.o_ccy}/${r.o_rate} total=${r.order_total} | DR=${r.dr_ccy} CR=${r.cr_ccy}`);
});
