import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const LID = "fd7a5f86-d45c-4c55-8685-e0c08b1b0909";
  console.log("=== DALIAN SUNSHINE ledger ===");
  console.log(JSON.stringify((await sql`SELECT id,code,name,currency,opening_balance,current_balance,debit_total,credit_total,normal_balance,enterprise_account_id FROM public.ledgers WHERE id=${LID}`)[0], null, 1));
  console.log("\n=== its roznamcha lines (all history) ===");
  const rl = await sql`SELECT l.debit, l.credit, l.currency, l.usd_rate, l.usd_amount, l.description, e.entry_date, e.journal_no, e.original_currency_code, e.base_currency_amount, e.narration
    FROM public.roznamcha_lines l JOIN public.roznamcha_entries e ON e.id=l.roznamcha_entry_id
    WHERE l.ledger_id=${LID} ORDER BY e.entry_date, e.created_at`;
  for (const r of rl) console.log(` ${r.entry_date?.toISOString?.().slice(0,10)} Dr ${r.debit} Cr ${r.credit} [${r.currency} xr ${r.usd_rate}] usd_amt=${r.usd_amount} | entryOrig=${r.original_currency_code} base=${r.base_currency_amount} | ${String(r.description||r.narration||'').slice(0,55)}`);
  console.log("\ntotal lines:", rl.length);
  // are all DALIAN lines USD-labeled?
  const byccy = await sql`SELECT l.currency, count(*)::int n, sum(l.debit) dr, sum(l.credit) cr FROM public.roznamcha_lines l WHERE l.ledger_id=${LID} GROUP BY l.currency`;
  console.log("by line currency:", JSON.stringify(byccy));
  // enterprise_account balance
  console.log("EA:", JSON.stringify((await sql`SELECT code,name,currency,current_balance FROM public.enterprise_accounts WHERE id=(SELECT enterprise_account_id FROM public.ledgers WHERE id=${LID})`)[0]));
});
