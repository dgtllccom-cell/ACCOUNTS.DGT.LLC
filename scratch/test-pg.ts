import { withLocalPg } from "../lib/db/local-postgres";

async function run() {
  const result = await withLocalPg(async (sql) => {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const banks = await sql`SELECT id, bank_name, short_name, account_number FROM public.banks LIMIT 10`;
    const entries = await sql`
      SELECT e.id, e.voucher_no, e.entry_serial_number, e.type, e.entry_category, e.status, e.entry_date, e.reference_no, e.narration
      FROM public.roznamcha_entries e
      ORDER BY e.created_at DESC
      LIMIT 10
    `;
    const companies = await sql`SELECT id, name FROM public.companies LIMIT 5`;
    const branches = await sql`SELECT id, name, code FROM public.city_branches LIMIT 5`;
    const countryBranches = await sql`SELECT id, name, code FROM public.country_branches LIMIT 5`;
    return { tables, banks, entries, companies, branches, countryBranches };
  });

  console.log("All tables:", result?.tables.map(t => t.table_name).join(", "));
  console.log("Banks count:", result?.banks.length, result?.banks);
  console.log("Sample Roznamcha entries:", result?.entries);
  console.log("Companies:", result?.companies);
  console.log("City Branches:", result?.branches);
  console.log("Country Branches:", result?.countryBranches);
}

run().catch(console.error);
