import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const tables = ['purchase_orders', 'sales_orders', 'purchase_order_payments', 'sales_order_payments', 'ledgers', 'roznamcha_entries', 'exchange_rates', 'countries', 'country_branches'];

  for (const table of tables) {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = ${table}
      ORDER BY ordinal_position;
    `;
    console.log(`\n=== TABLE: ${table} (${cols.length} columns) ===`);
    console.log(cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }

  await sql.end();
}

main().catch(console.error);
