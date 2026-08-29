import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  // sample POs that HAVE payments, across currency patterns
  const pos = await sql`
    SELECT DISTINCT o.id, o.purchase_order_no, o.currency_code, o.purchase_currency, o.exchange_rate, o.order_total,
           o.advance_paid, o.remaining_paid, o.credit_amount, o.remaining_due, o.payment_status
    FROM public.purchase_orders o
    JOIN public.purchase_order_payments p ON p.purchase_order_id=o.id AND p.deleted_at IS NULL AND p.status='posted' AND p.kind IN ('advance','remaining','credit')
    WHERE o.deleted_at IS NULL
    ORDER BY o.exchange_rate DESC NULLS LAST, o.purchase_order_no
    LIMIT 30`;
  console.log(`checking ${pos.length} historical POs with payments — recalc must not shift correct values\n`);
  let changed = 0, ok = 0;
  for (const po of pos) {
    const before = { a: Number(po.advance_paid), r: Number(po.remaining_paid), c: Number(po.credit_amount), d: Number(po.remaining_due), s: po.payment_status };
    await sql`SELECT recalc_purchase_order_payment_totals(${po.id}::uuid)`;
    const a = (await sql`SELECT advance_paid, remaining_paid, credit_amount, remaining_due, payment_status FROM public.purchase_orders WHERE id=${po.id}`)[0];
    const after = { a: Number(a.advance_paid), r: Number(a.remaining_paid), c: Number(a.credit_amount), d: Number(a.remaining_due), s: a.payment_status };
    const diff = ['a','r','c','d'].some(k => Math.abs(before[k]-after[k]) > 0.01) || before.s !== after.s;
    if (diff) {
      changed++;
      console.log(` Δ ${po.purchase_order_no} [${po.purchase_currency}/xr${po.exchange_rate}] total=${po.order_total}`);
      console.log(`     before adv=${before.a} rem=${before.r} cr=${before.c} due=${before.d} [${before.s}]`);
      console.log(`     after  adv=${after.a} rem=${after.r} cr=${after.c} due=${after.d} [${after.s}]`);
    } else ok++;
  }
  console.log(`\n${ok} unchanged, ${changed} changed`);
});
