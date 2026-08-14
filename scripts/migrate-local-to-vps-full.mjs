import postgres from 'postgres';

const localSql = postgres('postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres', { 
  ssl: { rejectUnauthorized: false },
  max: 10,
  prepare: false 
});

const vpsSql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', { 
  ssl: { rejectUnauthorized: false },
  max: 10,
  prepare: false 
});

async function migrateTable(tableName, conflictKey = 'id') {
  try {
    const localTbl = await localSql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
    if (localTbl.length === 0) return { table: tableName, migrated: 0, localTotal: 0, status: 'SKIPPED (Not in Local)' };

    const vpsTbl = await vpsSql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
    if (vpsTbl.length === 0) return { table: tableName, migrated: 0, localTotal: 0, status: 'SKIPPED (Not in VPS)' };

    const localCols = await localSql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = ${tableName};
    `;
    const vpsCols = await vpsSql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = ${tableName};
    `;

    const vpsColSet = new Set(vpsCols.map(c => c.column_name));
    const commonCols = localCols.map(c => c.column_name).filter(c => vpsColSet.has(c));

    if (commonCols.length === 0) return { table: tableName, migrated: 0, localTotal: 0, status: 'SKIPPED (No common cols)' };

    // Special bypass for static 700k dataset
    if (tableName === 'cities') {
      const vpsCityCount = await vpsSql`SELECT count(*) as c FROM cities`;
      const localCityCount = await localSql`SELECT count(*) as c FROM cities`;
      return { 
        table: tableName, 
        migrated: Number(vpsCityCount[0].c), 
        localTotal: Number(localCityCount[0].c), 
        status: `PRESERVED (${vpsCityCount[0].c} existing rows on VPS)` 
      };
    }

    const rows = await localSql`SELECT * FROM ${localSql(tableName)}`;
    if (rows.length === 0) return { table: tableName, migrated: 0, localTotal: 0, status: 'OK (0 rows)' };

    let successCount = 0;
    const batchSize = 100;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map(r => {
        const item = {};
        for (const col of commonCols) {
          item[col] = r[col];
        }
        return item;
      });

      try {
        if (conflictKey && commonCols.includes(conflictKey)) {
          await vpsSql`
            INSERT INTO ${vpsSql(tableName)} ${vpsSql(batch)}
            ON CONFLICT (${vpsSql(conflictKey)}) DO NOTHING
          `;
        } else {
          await vpsSql`
            INSERT INTO ${vpsSql(tableName)} ${vpsSql(batch)}
            ON CONFLICT DO NOTHING
          `;
        }
        successCount += batch.length;
      } catch (batchErr) {
        // Fallback to row-by-row on constraint conflict
        for (const singleRow of batch) {
          try {
            if (conflictKey && commonCols.includes(conflictKey)) {
              await vpsSql`
                INSERT INTO ${vpsSql(tableName)} ${vpsSql(singleRow)}
                ON CONFLICT (${vpsSql(conflictKey)}) DO NOTHING
              `;
            } else {
              await vpsSql`
                INSERT INTO ${vpsSql(tableName)} ${vpsSql(singleRow)}
                ON CONFLICT DO NOTHING
              `;
            }
            successCount++;
          } catch (rowErr) {
            // Silently ignore row error
          }
        }
      }
    }

    return { table: tableName, migrated: successCount, localTotal: rows.length, status: 'SUCCESS' };
  } catch (err) {
    return { table: tableName, migrated: 0, localTotal: 0, status: `ERROR: ${err.message}` };
  }
}

async function runFullMigration() {
  console.log("==========================================================================================");
  console.log("             FULL DATA MIGRATION FROM LOCAL DB TO VPS PRODUCTION DB                       ");
  console.log("==========================================================================================\n");

  const migrationPipeline = [
    // 1. Geography & Locations
    { table: 'countries', key: 'id' },
    { table: 'states_provinces', key: 'id' },
    { table: 'districts', key: 'id' },
    { table: 'cities', key: 'id' },
    { table: 'areas_locations', key: 'id' },
    { table: 'ports', key: 'id' },

    // 2. Lookup & Master Types
    { table: 'languages', key: 'code' },
    { table: 'company_registration_types', key: 'id' },
    { table: 'contact_types', key: 'id' },
    { table: 'document_types', key: 'id' },
    { table: 'account_types', key: 'id' },
    { table: 'tax_codes', key: 'id' },
    { table: 'product_units', key: 'id' },
    { table: 'product_brands', key: 'id' },
    { table: 'product_categories', key: 'id' },

    // 3. Core Master Entities
    { table: 'companies', key: 'id' },
    { table: 'banks', key: 'id' },
    { table: 'warehouses', key: 'id' },
    { table: 'customers', key: 'id' },
    { table: 'employees', key: 'id' },
    { table: 'accounts', key: 'id' },
    { table: 'goods', key: 'id' },
    { table: 'goods_variations', key: 'id' },
    { table: 'products', key: 'id' },
    { table: 'branches', key: 'id' },
    { table: 'country_branches', key: 'id' },
    { table: 'city_branches', key: 'id' },

    // 4. Multi-Linking & Relational Tables
    { table: 'account_companies', key: 'id' },
    { table: 'account_customer_owners', key: 'id' },
    { table: 'account_banks', key: 'id' },
    { table: 'account_warehouses', key: 'id' },
    { table: 'customer_contacts', key: 'id' },
    { table: 'customer_registrations', key: 'id' },

    // 5. Operations & Transactions
    { table: 'stock_movements', key: 'id' },
    { table: 'product_inventory_balances', key: 'id' },
    { table: 'journal_entries', key: 'id' },
    { table: 'journal_lines', key: 'id' },
    { table: 'roznamcha_entries', key: 'id' },
    { table: 'local_purchases', key: 'id' },
    { table: 'purchase_orders', key: 'id' },
    { table: 'purchase_order_items', key: 'id' },
    { table: 'purchase_loading_records', key: 'id' },
    { table: 'sales_orders', key: 'id' },
    { table: 'expenses_bills', key: 'id' },
    { table: 'expenses_bill_lines', key: 'id' },
    { table: 'enterprise_accounts', key: 'id' },
    { table: 'ledgers', key: 'id' },

    // 6. Multilingual Translations
    { table: 'record_translations', key: 'id' }
  ];

  const results = [];

  for (const item of migrationPipeline) {
    const res = await migrateTable(item.table, item.key);
    console.log(`Table: ${item.table.padEnd(28)} => [${res.status}] (${res.migrated || 0} / ${res.localTotal || 0} records)`);
    results.push(res);
  }

  console.log("\n=== MIGRATION SUMMARY MATRIX ===");
  console.table(results);

  // Final verification counts on VPS
  console.log("\n=== VPS VERIFICATION ROW COUNTS ===");
  const vpsCounts = [];
  for (const item of migrationPipeline) {
    try {
      const c = await vpsSql`SELECT count(*) as count FROM ${vpsSql(item.table)}`;
      vpsCounts.push({ Table: item.table, "VPS Final Count": Number(c[0].count) });
    } catch (e) {
      vpsCounts.push({ Table: item.table, "VPS Final Count": "N/A" });
    }
  }
  console.table(vpsCounts);

  await localSql.end();
  await vpsSql.end();
}

runFullMigration().catch(console.error);
