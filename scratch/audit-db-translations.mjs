import postgres from 'postgres';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function auditDatabaseTranslations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not found!");
    return;
  }
  const sql = postgres(dbUrl, { prepare: false, idle_timeout: 5, connect_timeout: 10 });

  try {
    console.log("=== STEP 1: Querying Database Schema for Translation Tables ===");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%translat%' OR table_name LIKE '%i18n%' OR table_name LIKE '%locale%' OR table_name LIKE '%dictionary%')
      ORDER BY table_name;
    `;
    console.log("Translation tables found:", tables);

    // Let's check master data tables
    const masterTables = [
      'countries',
      'country_branches',
      'city_branches',
      'account_types',
      'document_types',
      'contact_types',
      'product_units',
      'product_categories',
      'product_brands',
      'goods_registry',
      'enterprise_accounts',
      'warehouses',
      'ports',
      'shipping_lines',
      'clearing_agents',
      'companies',
      'employees'
    ];

    const results = [];

    for (const t of masterTables) {
      try {
        const columns = await sql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = ${t};
        `;
        const countRes = await sql.unsafe(`SELECT count(*)::int as c FROM "${t}" WHERE deleted_at IS NULL;`).catch(() => [{ c: 0 }]);
        const total = countRes[0]?.c || 0;

        const colNames = columns.map(c => c.column_name);
        const hasJsonbTranslations = colNames.includes('translations') || colNames.includes('i18n');
        const langCols = colNames.filter(c => c.includes('_ur') || c.includes('_ar') || c.includes('_fa') || c.includes('_ps') || c.includes('_en'));

        results.push({
          table: t,
          totalRecords: total,
          columns: colNames,
          hasJsonbTranslations,
          langCols
        });
      } catch (e) {
        results.push({
          table: t,
          totalRecords: 0,
          error: e.message
        });
      }
    }

    // Check if system translations or any translation rows exist
    let translationTableData = {};
    for (const t of tables) {
      const tableName = t.table_name;
      try {
        const count = await sql.unsafe(`SELECT count(*)::int as c FROM "${tableName}";`);
        const sample = await sql.unsafe(`SELECT * FROM "${tableName}" LIMIT 5;`);
        translationTableData[tableName] = {
          rowCount: count[0]?.c || 0,
          sample
        };
      } catch (err) {
        translationTableData[tableName] = { error: err.message };
      }
    }

    const auditOutput = {
      translationTables: tables,
      translationTableData,
      masterEntities: results,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('scratch/db_translation_audit.json', JSON.stringify(auditOutput, null, 2), 'utf8');
    console.log("Audit completed successfully! Saved to scratch/db_translation_audit.json");
    console.log("Entities summary:", JSON.stringify(results.map(r => ({ table: r.table, total: r.totalRecords })), null, 2));
  } catch (err) {
    console.error("Database audit error:", err);
  } finally {
    await sql.end();
  }
}

auditDatabaseTranslations();
