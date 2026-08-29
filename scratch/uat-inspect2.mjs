import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='enterprise_accounts' ORDER BY ordinal_position`;
  console.log("enterprise_accounts columns:", cols.map(c=>c.column_name).join(", "));

  const dtc = await sql`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (table_name ILIKE '%account%' OR table_name ILIKE '%chart%' OR table_name ILIKE '%ledger%' OR table_name ILIKE '%coa%')
    ORDER BY 1`;
  console.log("\naccount-ish tables:\n", dtc.map(t=>t.table_name).join("\n "));
});
