import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const po = (await sql`SELECT id, purchase_order_no, purchase_contract_no, country_id, country_branch_id, city_branch_id, currency_code, purchase_currency, payment_currency, exchange_rate, order_total, total_goods_local, ledger_posting_status, status, form_data FROM public.purchase_orders WHERE id='1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e'`)[0];
  console.log("PO:", po.purchase_order_no, po.purchase_contract_no, "| cur", po.currency_code, "rate", po.exchange_rate, "total", po.order_total, "local", po.total_goods_local, "| posting", po.ledger_posting_status, po.status);
  console.log("form.form:", JSON.stringify(po.form_data?.form));
  console.log("\nDALIAN ledger now:", JSON.stringify((await sql`SELECT code,name,currency,current_balance FROM public.ledgers WHERE id='fd7a5f86-d45c-4c55-8685-e0c08b1b0909'`)[0]));
  console.log("AE Purchase ledger:", JSON.stringify((await sql`SELECT code,currency,current_balance FROM public.ledgers WHERE id='7b2c589f-9924-40c1-af78-6c9fc30630ed'`)[0]));
  console.log("AE Bank ledger:", JSON.stringify((await sql`SELECT code,currency,current_balance FROM public.ledgers WHERE id='6b24ea23-9514-4311-aba3-94ba99a993f8'`)[0]));
  console.log("\njob:", JSON.stringify((await sql`SELECT job_no, status, matched_source_id FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0]));
});
