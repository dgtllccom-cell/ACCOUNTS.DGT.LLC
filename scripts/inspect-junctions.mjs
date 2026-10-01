import { withLocalPg } from "../lib/db/local-postgres.ts";

async function main() {
  await withLocalPg(async (sql) => {
    const tables = ['account_companies', 'account_banks', 'account_customer_owners', 'enterprise_account_warehouses', 'account_warehouses'];
    for (const t of tables) {
      console.log(`\n=== Table: ${t} ===`);
      const cols = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = ${t}
        ORDER BY ordinal_position;
      `;
      cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
    }
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
