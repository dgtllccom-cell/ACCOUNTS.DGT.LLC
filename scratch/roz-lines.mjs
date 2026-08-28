import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='roznamcha_lines' ORDER BY ordinal_position`;
  console.log(c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
  const s = await sql`SELECT entry_date, original_currency_code, base_currency_amount, source_module, source_reference_no, super_admin_serial, country_serial, branch_serial, entry_serial FROM public.roznamcha_entries WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 2`;
  console.log(JSON.stringify(s, null, 1));
});
process.exit(0);
