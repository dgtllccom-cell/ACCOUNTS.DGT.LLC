import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

const TARGET_TABLES = [
  'customers',
  'companies',
  'employees',
  'banks',
  'warehouses',
  'trucks',
  'goods',
  'products',
  'enterprise_accounts',
  'purchase_orders',
  'purchase_order_payments',
  'local_purchases',
  'purchase_loadings',
  'truck_loadings',
  'import_truck_loadings',
  'transit_truck_loadings',
  'sales_orders',
  'sales_order_payments',
  'roznamcha_entries',
  'roznamcha_lines',
  'journal_entries',
  'ledger_entries',
  'money_exchange_entries',
  'expenses_bills',
  'transit_entries',
  'shipping_bl_records',
  'shipping_lines',
  'clearing_agents'
];

async function main() {
  try {
    console.log("=== AUDITING SERIAL COLUMNS ACROSS ALL ERP TABLES ===");
    const results = [];
    for (const t of TARGET_TABLES) {
      const cols = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${t}
          AND (
            column_name LIKE '%serial%' OR 
            column_name LIKE '%code%' OR 
            column_name LIKE '%number%'
          );
      `;
      results.push({
        table: t,
        columns: cols.map(c => c.column_name).join(", ")
      });
    }
    console.table(results);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
