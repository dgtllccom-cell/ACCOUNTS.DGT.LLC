import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const poId="1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e";
  console.log("=== ALL purchase_order_payments for AE-001-0022 ===");
  const pp = await sql`SELECT kind, entry_date, amount, currency_code, exchange_rate, base_currency_amount, original_currency_code, status, reference_no, roznamcha_entry_id FROM public.purchase_order_payments WHERE purchase_order_id=${poId} ORDER BY created_at`;
  for (const p of pp) console.log(` ${p.kind.padEnd(8)} ${p.entry_date.toISOString().slice(0,10)}  ${p.original_currency_code} ${p.amount}  @ ${p.exchange_rate}  = ${p.base_currency_amount} AED   [${p.status}] ref=${p.reference_no}`);

  console.log("\n=== advance payment roznamcha lines ===");
  const advRoz = pp.find(p=>p.kind==='advance')?.roznamcha_entry_id;
  const rl = await sql`SELECT l.payment_entry_type, g.name led, g.currency lc, l.debit, l.credit, l.currency FROM public.roznamcha_lines l LEFT JOIN public.ledgers g ON g.id=l.ledger_id WHERE l.roznamcha_entry_id=${advRoz} ORDER BY l.payment_entry_type`;
  for (const r of rl) console.log(`  ${r.payment_entry_type} | ${r.led} (${r.lc}) | Dr ${r.debit} Cr ${r.credit} | ${r.currency}`);
  const t=(await sql`SELECT sum(debit) d, sum(credit) c FROM public.roznamcha_lines WHERE roznamcha_entry_id=${advRoz}`)[0];
  console.log(`  balanced: ${Number(t.d)===Number(t.c)} (Dr ${t.d} Cr ${t.c})`);

  console.log("\n=== PO payment rollup ===");
  const po=(await sql`SELECT order_total, advance_paid, remaining_paid, remaining_due, payment_status, ledger_posting_status FROM public.purchase_orders WHERE id=${poId}`)[0];
  console.log(JSON.stringify(po));

  console.log("\n=== full accounting trace: contract → PO → payments → roznamcha → ledger ===");
  const trace = await sql`
    SELECT e.journal_no, e.voucher_no, e.entry_date, e.source_reference_no, e.original_currency_code, e.base_currency_amount, e.status
    FROM public.roznamcha_entries e
    WHERE e.source_transaction_id IN (SELECT id FROM public.purchase_order_payments WHERE purchase_order_id=${poId})
       OR e.source_transaction_id=${poId}
    ORDER BY e.created_at`;
  for (const x of trace) console.log(` ${x.journal_no} / ${x.voucher_no} ${x.entry_date.toISOString().slice(0,10)} | ${x.source_reference_no} | ${x.original_currency_code} base ${x.base_currency_amount} AED [${x.status}]`);

  console.log("\n=== duplicate guard proof ===");
  const dup=(await sql`SELECT count(*)::int n FROM public.roznamcha_entries WHERE source_module='purchase' AND source_transaction_type='purchase_booking_transfer' AND source_transaction_id=${poId} AND deleted_at IS NULL AND status<>'cancelled'`)[0].n;
  console.log(`  booking roznamcha entries for this PO: ${dup} (expect 1)`);
  const dupPo=(await sql`SELECT count(*)::int n FROM public.purchase_orders WHERE purchase_contract_no='DSA2025-0908' AND deleted_at IS NULL`)[0].n;
  console.log(`  purchase_orders with contract DSA2025-0908: ${dupPo} (expect 1)`);
});
