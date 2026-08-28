import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const re = await sql`SELECT id, voucher_no, journal_no, entry_serial, status, source_module, source_reference_no, narration FROM public.roznamcha_entries WHERE source_module = 'hr_payroll' OR narration ILIKE '%PR-202609%' OR voucher_no ILIKE '%PR-202609%' ORDER BY created_at DESC LIMIT 12`;
  console.log(JSON.stringify(re, null, 1));
});
process.exit(0);
