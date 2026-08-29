import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const rl = await sql`SELECT payment_entry_type, currency, debit, credit, usd_rate, usd_amount FROM public.roznamcha_lines WHERE roznamcha_entry_id='91ee0b38-8480-4008-9751-62bbd37ba10e' ORDER BY payment_entry_type`;
  for (const r of rl) console.log(JSON.stringify(r));
  const ecols = (await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='roznamcha_entries' AND (column_name ILIKE '%currency%' OR column_name ILIKE '%rate%' OR column_name ILIKE '%usd%' OR column_name ILIKE '%amount%' OR column_name ILIKE '%base%')`).then(r=>r.map(c=>c.column_name));
  console.log("entry fx cols:", ecols.join(", "));
  const e = (await sql`SELECT original_currency_code, currency_name, base_currency_amount FROM public.roznamcha_entries WHERE id='91ee0b38-8480-4008-9751-62bbd37ba10e'`)[0];
  console.log("ENTRY:", JSON.stringify(e));
});
