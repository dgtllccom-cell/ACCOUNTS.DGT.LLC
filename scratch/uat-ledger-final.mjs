import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("=== ledgers (should be back to pre-UAT) ===");
  for (const l of await sql`SELECT code,name,currency,current_balance,debit_total,credit_total FROM public.ledgers WHERE id IN ('7b2c589f-9924-40c1-af78-6c9fc30630ed','fd7a5f86-d45c-4c55-8685-e0c08b1b0909','6b24ea23-9514-4311-aba3-94ba99a993f8')`)
    console.log(` ${l.code.padEnd(22)} (${l.currency}) bal=${l.current_balance} dr=${l.debit_total} cr=${l.credit_total}`);
  console.log("\n=== all roznamcha entries from this UAT (PO + reversals) ===");
  const es = await sql`SELECT voucher_no, journal_no, status, base_currency_amount, narration FROM public.roznamcha_entries WHERE source_reference_no LIKE '%DSA2025-0908%' OR source_reference_no LIKE '%AE-001-0022%' OR narration LIKE '%DSA2025-0908%' ORDER BY created_at`;
  for (const e of es) console.log(` ${e.voucher_no} [${e.status}] ${e.base_currency_amount} — ${String(e.narration).slice(0,70)}`);
  console.log("\n=== reversal entries (look for REV/reversal) ===");
  const rv = await sql`SELECT voucher_no, journal_no, status, base_currency_amount, narration, created_at FROM public.roznamcha_entries WHERE created_at > now() - interval '30 minutes' AND (narration ILIKE '%revers%' OR voucher_no ILIKE '%REV%' OR journal_no ILIKE '%REV%') ORDER BY created_at`;
  for (const e of rv) console.log(` ${e.voucher_no} / ${e.journal_no} [${e.status}] ${e.base_currency_amount} — ${String(e.narration).slice(0,80)}`);
  console.log("\n=== net effect on the 3 ledgers from ALL DSA2025-0908 lines ===");
  const net = await sql`
    SELECT g.code, g.currency, sum(l.debit) dr, sum(l.credit) cr, sum(l.debit)-sum(l.credit) net
    FROM public.roznamcha_lines l
    JOIN public.roznamcha_entries e ON e.id=l.roznamcha_entry_id
    JOIN public.ledgers g ON g.id=l.ledger_id
    WHERE (e.source_reference_no LIKE '%AE-001-0022%' OR e.narration LIKE '%DSA2025-0908%' OR e.narration ILIKE '%033DBFC252760922%')
    GROUP BY g.code, g.currency`;
  for (const n of net) console.log(` ${n.code} (${n.currency}): Dr ${n.dr} Cr ${n.cr} → NET ${n.net}  (0 = fully reversed)`);
});
