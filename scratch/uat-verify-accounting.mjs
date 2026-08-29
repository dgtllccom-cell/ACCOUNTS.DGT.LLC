import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const poId = "1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e";
  const rozId = "91ee0b38-8480-4008-9751-62bbd37ba10e";

  console.log("=== purchase_orders row ===");
  const po = (await sql`SELECT purchase_order_no, purchase_contract_no, purchase_currency, payment_currency, currency_code, exchange_rate, order_total, total_goods_original, total_goods_local, total_goods_usd, advance_paid, remaining_due, payment_status, ledger_posting_status, status FROM public.purchase_orders WHERE id=${poId}`)[0];
  console.log(JSON.stringify(po, null, 1));

  console.log("\n=== roznamcha_entries (booking) ===");
  const re = await sql`SELECT id, journal_no, voucher_no, entry_date, type, status, source_module, source_transaction_type, source_transaction_id, source_reference_no, original_currency_code, currency_name, base_currency_amount, entry_category, narration FROM public.roznamcha_entries WHERE id=${rozId}`;
  console.log(JSON.stringify(re[0], null, 1));
  console.log("dup check — entries for this PO:", (await sql`SELECT count(*)::int n FROM public.roznamcha_entries WHERE source_transaction_id=${poId} AND source_module='purchase' AND deleted_at IS NULL AND status<>'cancelled'`)[0].n);

  console.log("\n=== roznamcha_lines ===");
  const rl = await sql`SELECT l.payment_entry_type, l.ledger_id, g.name AS ledger, g.currency AS ledger_ccy, l.debit, l.credit, l.currency, l.exchange_rate, l.description
    FROM public.roznamcha_lines l LEFT JOIN public.ledgers g ON g.id=l.ledger_id WHERE l.roznamcha_entry_id=${rozId} ORDER BY l.payment_entry_type`;
  for (const r of rl) console.log(` ${r.payment_entry_type.padEnd(7)} ${String(r.ledger).slice(0,42).padEnd(43)} ${r.ledger_ccy}  Dr ${r.debit}  Cr ${r.credit}  lineCcy ${r.currency} xr ${r.exchange_rate}`);
  const tot = await sql`SELECT sum(debit) d, sum(credit) c FROM public.roznamcha_lines WHERE roznamcha_entry_id=${rozId}`;
  console.log(` TOTALS: Dr ${tot[0].d}  Cr ${tot[0].c}  balanced: ${Number(tot[0].d)===Number(tot[0].c)}`);

  console.log("\n=== purchase_order_payments ===");
  const pp = await sql`SELECT kind, entry_date, amount, currency_code, exchange_rate, base_currency_amount, original_currency_code, status, reference_no, roznamcha_entry_id FROM public.purchase_order_payments WHERE purchase_order_id=${poId} ORDER BY created_at`;
  for (const p of pp) console.log(JSON.stringify(p));

  console.log("\n=== ledger balances (DR purchase / CR supplier) ===");
  const lb = await sql`SELECT code, name, currency, current_balance, debit_total, credit_total FROM public.ledgers WHERE id IN ('7b2c589f-9924-40c1-af78-6c9fc30630ed','fd7a5f86-d45c-4c55-8685-e0c08b1b0909')`;
  for (const l of lb) console.log(` ${l.code.padEnd(22)} ${l.currency} bal=${l.current_balance} dr_total=${l.debit_total} cr_total=${l.credit_total}`);

  console.log("\n=== document_intake_job final state ===");
  const jb = (await sql`SELECT job_no, status, matched_source_module, matched_source_id, draft_reference FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0];
  console.log(JSON.stringify(jb));
  console.log("\n=== audit / events ===");
  const ev = await sql`SELECT event_type, created_at FROM public.document_intake_events WHERE job_id='56c876c0-aef5-4247-820d-e7be022aa22f' ORDER BY created_at`.catch(()=>sql`SELECT event, created_at FROM public.document_intake_events WHERE job_id='56c876c0-aef5-4247-820d-e7be022aa22f' ORDER BY created_at`);
  for (const e of ev) console.log(" ", e.event_type||e.event, e.created_at?.toISOString?.()||e.created_at);
});
