import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const s = await sql`SELECT settlement_no, status, net_settlement, roznamcha_entry_id, journal_entry_id FROM public.hr_gratuity_settlements WHERE id='fa60791d-d5d3-4193-9cac-d532605e0357'`.catch(async()=>sql`SELECT settlement_no, status, net_settlement FROM public.hr_gratuity_settlements WHERE id='fa60791d-d5d3-4193-9cac-d532605e0357'`);
  console.log("settlement:", JSON.stringify(s[0]));
  const re = await sql`SELECT re.voucher_no, re.narration, round(sum(rl.debit),2) dr, round(sum(rl.credit),2) cr
    FROM public.roznamcha_entries re JOIN public.roznamcha_lines rl ON rl.roznamcha_entry_id=re.id
    WHERE re.narration ILIKE '%gratuity%' OR re.narration ILIKE '%settlement%' OR re.voucher_no ILIKE '%FS-0001%'
    GROUP BY re.id, re.voucher_no, re.narration ORDER BY re.created_at DESC LIMIT 3`;
  console.log("gratuity roznamcha:", JSON.stringify(re));
  // separation status
  const sep = await sql`SELECT status, settlement_status FROM public.hr_employee_separations WHERE id='fa71cea6-5655-4bc7-a843-c41edccecfa7'`;
  console.log("separation:", JSON.stringify(sep[0]));
});
process.exit(0);
