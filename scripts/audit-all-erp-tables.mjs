import postgres from 'postgres';

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("=== CHECKING ALL TABLES AND TRANSLATIONS ON VPS ===");
  
  // 1. Check all tables in public schema
  const tables = await vpsSql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  console.log(`Found ${tables.length} tables in database.`);

  // 2. Check record_translations totals
  const totalTranslations = await vpsSql`SELECT count(*) as count FROM record_translations WHERE deleted_at IS NULL`;
  console.log(`Total Active Translations on VPS: ${totalTranslations[0].count}`);

  // 3. Breakdown of translations by table and language
  const breakdown = await vpsSql`
    SELECT 
      record_table,
      COUNT(DISTINCT record_id) as unique_records,
      COUNT(*) FILTER (WHERE english_text IS NOT NULL AND english_text != '') as en_count,
      COUNT(*) FILTER (WHERE urdu_text IS NOT NULL AND urdu_text != '') as ur_count,
      COUNT(*) FILTER (WHERE arabic_text IS NOT NULL AND arabic_text != '') as ar_count,
      COUNT(*) FILTER (WHERE persian_text IS NOT NULL AND persian_text != '') as fa_count,
      COUNT(*) FILTER (WHERE pashto_text IS NOT NULL AND pashto_text != '') as ps_count,
      COUNT(*) as total_records
    FROM record_translations
    WHERE deleted_at IS NULL
    GROUP BY record_table
    ORDER BY total_records DESC;
  `;
  
  console.log("\n=== 5-LANGUAGE TRANSLATION COVERAGE BY MASTER TABLE ===");
  console.table(breakdown);

  // 4. Check core master tables row counts
  const masterTables = [
    'accounts', 'companies', 'banks', 'warehouses', 'customers',
    'goods', 'products', 'inventory_balances', 'stock_movements',
    'employees', 'locations', 'ports', 'company_registration_types',
    'contact_types', 'document_types', 'account_types', 'tax_codes',
    'product_units', 'product_brands', 'product_categories',
    'countries', 'states_provinces', 'districts', 'cities',
    'account_company_links', 'account_customer_links', 'account_bank_links', 'account_warehouse_links'
  ];

  console.log("\n=== CORE MASTER & LINKING TABLES ROW COUNTS ===");
  const counts = [];
  for (const t of masterTables) {
    try {
      const res = await vpsSql`SELECT count(*) as count FROM ${vpsSql(t)}`;
      counts.push({ Table: t, RowCount: Number(res[0].count), Status: 'OK' });
    } catch (err) {
      counts.push({ Table: t, RowCount: 'N/A', Status: `Error: ${err.message}` });
    }
  }
  console.table(counts);

  await vpsSql.end();
}

main().catch(console.error);
