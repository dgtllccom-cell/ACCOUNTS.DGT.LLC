import { withLocalPg } from "../lib/db/local-postgres";

async function inspectMore() {
  const result = await withLocalPg(async (sql) => {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name ILIKE '%ship%' OR table_name ILIKE '%clear%' OR table_name ILIKE '%order%' OR table_name ILIKE '%roz%'
      ORDER BY table_name;
    `;
    return tables;
  });
  console.log("Matching tables:", result.map(r => r.table_name));
}

inspectMore().catch(console.error);
