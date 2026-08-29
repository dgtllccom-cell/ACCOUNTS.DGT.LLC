import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const po = await sql`SELECT id, purchase_order_no, purchase_contract_no, currency_code, purchase_currency, payment_currency, exchange_rate, order_total, total_goods_original, total_goods_local, total_goods_usd, ledger_posting_status, status, country_id, country_branch_id, city_branch_id, form_data
    FROM public.purchase_orders WHERE deleted_at IS NULL AND ledger_posting_status='posted' ORDER BY created_at DESC LIMIT 2`;
  for (const r of po) {
    console.log("PO", r.purchase_order_no, "cur", r.currency_code, "/pur", r.purchase_currency, "rate", r.exchange_rate, "total", r.order_total, "goods o/l/u", r.total_goods_original, r.total_goods_local, r.total_goods_usd, "status", r.status, r.ledger_posting_status);
    const f = r.form_data?.form || {};
    console.log("  form keys:", Object.keys(f).slice(0,40).join(","));
    console.log("  acct fields:", JSON.stringify({purchaseAccountLedgerId:f.purchaseAccountLedgerId, purchaseAccountId:f.purchaseAccountId, purchaseAccountName:f.purchaseAccountName, supplierAccountId:f.supplierAccountId, salesAccountId:f.salesAccountId, supplierName:f.supplierName, salesAccountNo:f.salesAccountNo}));
    console.log("  totals:", JSON.stringify(r.form_data?.totals));
    console.log("  goodsEntries:", JSON.stringify((r.form_data?.form?.goodsEntries||r.form_data?.goodsEntries||[]).slice(0,2)));
  }
});
