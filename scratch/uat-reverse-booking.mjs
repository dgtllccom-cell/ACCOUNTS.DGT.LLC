import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const poId="1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e";
  const bk=(await sql`SELECT id, roznamcha_entry_id FROM public.purchase_order_payments WHERE purchase_order_id=${poId} AND kind='booking' AND deleted_at IS NULL`)[0];
  console.log("booking payment:", bk?.id, "roz:", bk?.roznamcha_entry_id);
  const r = await sql`SELECT reverse_roznamcha_entry(${bk.roznamcha_entry_id}::uuid, 'Real-contract UAT — booking held pending supplier-account currency decision (DALIAN SUNSHINE is USD-denominated; posting is AED-functional)', NULL::uuid) rev`;
  console.log("reversal entry:", JSON.stringify(r[0]));
  await sql`UPDATE public.purchase_order_payments SET status='cancelled', deleted_at=now() WHERE id=${bk.id}`;
  await sql`UPDATE public.purchase_orders SET ledger_posting_status='unposted', status='Draft' WHERE id=${poId}`;
  await sql`SELECT recalc_purchase_order_payment_totals(${poId}::uuid)`.catch(e=>console.log("recalc:",e.message));

  // verify clean
  const active=(await sql`SELECT count(*)::int n FROM public.roznamcha_entries WHERE source_transaction_id=${poId} AND source_module='purchase' AND deleted_at IS NULL AND status NOT IN ('cancelled','reversed')`)[0].n;
  console.log("active booking roznamcha entries now:", active);
  for (const l of await sql`SELECT code,name,currency,current_balance FROM public.ledgers WHERE id IN ('7b2c589f-9924-40c1-af78-6c9fc30630ed','fd7a5f86-d45c-4c55-8685-e0c08b1b0909')`)
    console.log(` ${l.code} (${l.currency}) bal=${l.current_balance}`);
  const po=(await sql`SELECT purchase_order_no, purchase_contract_no, purchase_currency, payment_currency, exchange_rate, order_total, total_goods_original, total_goods_local, ledger_posting_status, status FROM public.purchase_orders WHERE id=${poId}`)[0];
  console.log("PO:", JSON.stringify(po));
  const job=(await sql`SELECT job_no, status, matched_source_module, matched_source_id FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0];
  console.log("JOB:", JSON.stringify(job));
});
