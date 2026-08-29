import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const rozId = "91ee0b38-8480-4008-9751-62bbd37ba10e";
  const poId = "1d7f69ef-0b3c-4aa7-b02a-3e3928c18a2e";
  const cols = (await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='roznamcha_lines' ORDER BY ordinal_position`).map(c=>c.column_name);
  console.log("roznamcha_lines cols:", cols.join(", "));
  const rl = await sql`SELECT l.*, g.name AS ledger_name, g.currency AS ledger_ccy FROM public.roznamcha_lines l LEFT JOIN public.ledgers g ON g.id=l.ledger_id WHERE l.roznamcha_entry_id=${rozId} ORDER BY l.payment_entry_type`;
  for (const r of rl) console.log(` ${r.payment_entry_type} | ${r.ledger_name} (${r.ledger_ccy}) | debit=${r.debit} credit=${r.credit} | line ccy=${r.currency} | usd_rate=${r.usd_rate ?? r.exchange_rate_to_usd ?? '-'}`);
  const t = (await sql`SELECT sum(debit) d, sum(credit) c FROM public.roznamcha_lines WHERE roznamcha_entry_id=${rozId}`)[0];
  console.log(`TOTALS Dr ${t.d} Cr ${t.c} balanced=${Number(t.d)===Number(t.c)}`);

  console.log("\n=== purchase_order_payments ===");
  const pp = await sql`SELECT kind, amount, currency_code, exchange_rate, base_currency_amount, original_currency_code, status, reference_no FROM public.purchase_order_payments WHERE purchase_order_id=${poId} ORDER BY created_at`;
  for (const p of pp) console.log(" ", JSON.stringify(p));

  console.log("\n=== ledgers touched ===");
  for (const l of await sql`SELECT code,name,currency,current_balance,debit_total,credit_total FROM public.ledgers WHERE id IN ('7b2c589f-9924-40c1-af78-6c9fc30630ed','fd7a5f86-d45c-4c55-8685-e0c08b1b0909')`)
    console.log(` ${l.code} (${l.currency}) bal=${l.current_balance} dr=${l.debit_total} cr=${l.credit_total}`);

  console.log("\n=== ledger_entries / posting lines for this voucher ===");
  const le = await sql`SELECT to_regclass('public.ledger_entries') a, to_regclass('public.ledger_posting_lines') b`;
  if (le[0].b) {
    const rows = await sql`SELECT pl.*, g.name led FROM public.ledger_posting_lines pl LEFT JOIN public.ledgers g ON g.id=pl.ledger_id
      WHERE pl.roznamcha_entry_id=${rozId} OR pl.reference_no LIKE '%DSA2025-0908%' LIMIT 10`.catch(e=>[{ERR:e.message}]);
    console.log(JSON.stringify(rows, null, 1).slice(0,1500));
  }

  console.log("\n=== job + events (audit trail) ===");
  const jb = (await sql`SELECT job_no,status,matched_source_module,matched_source_id,draft_reference FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0];
  console.log(JSON.stringify(jb));
  const evcols=(await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='document_intake_events'`).map(c=>c.column_name);
  const tcol = evcols.includes('event_type')?'event_type':(evcols.includes('event')?'event':'kind');
  const ev = await sql.unsafe(`SELECT ${tcol} t, created_at FROM public.document_intake_events WHERE job_id='56c876c0-aef5-4247-820d-e7be022aa22f' ORDER BY created_at`);
  for (const e of ev) console.log("  •", e.t, new Date(e.created_at).toISOString());
});
