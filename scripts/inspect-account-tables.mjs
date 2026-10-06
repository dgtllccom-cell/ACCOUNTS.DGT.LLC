import { withLocalPg } from "../lib/db/local-postgres.ts";

async function main() {
  await withLocalPg(async (sql) => {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%account%' OR table_name LIKE '%company%' OR table_name LIKE '%bank%' OR table_name LIKE '%warehouse%')
      ORDER BY table_name;
    `;
    console.log("Matching tables in public schema:");
    tables.forEach(t => console.log(" - " + t.table_name));

    const eaCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'enterprise_accounts'
      ORDER BY ordinal_position;
    `;
    console.log("\nenterprise_accounts columns:");
    eaCols.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));
  });
}

main().catch(err => {
  console.error("Error inspecting tables:", err);
  process.exit(1);
});
