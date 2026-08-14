import fs from 'node:fs';
import postgres from 'postgres';

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, '');
  }
  return env;
}

const localEnv = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const vpsEnv = {
  DATABASE_URL: 'postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 10, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 15, prepare: false, ssl: { rejectUnauthorized: false } });

async function syncTable(tableName, key = 'id') {
  try {
    const [localExists] = await localSql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
    if (!localExists) return { Table: tableName, Local: 0, VPS: 0, Migrated: 0, Status: 'Not in Local' };

    const [vpsExists] = await vpsSql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName}`;
    if (!vpsExists) return { Table: tableName, Local: 0, VPS: 0, Migrated: 0, Status: 'Not in VPS' };

    const [localCountRes] = await localSql`SELECT count(*) as c FROM ${localSql(tableName)}`;
    const [vpsCountRes] = await vpsSql`SELECT count(*) as c FROM ${vpsSql(tableName)}`;
    const localCount = Number(localCountRes.c);
    let vpsCount = Number(vpsCountRes.c);

    if (tableName === 'cities' || tableName === 'districts' || tableName === 'states_provinces') {
      return { Table: tableName, Local: localCount, VPS: vpsCount, Migrated: 0, Status: 'Preserved (Geo Master)' };
    }

    if (localCount === 0) {
      return { Table: tableName, Local: 0, VPS: vpsCount, Migrated: 0, Status: 'Local Empty' };
    }

    const localCols = await localSql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName}`;
    const vpsCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName}`;
    const vpsColSet = new Set(vpsCols.map(c => c.column_name));
    const commonCols = localCols.map(c => c.column_name).filter(c => vpsColSet.has(c));

    const rows = await localSql`SELECT * FROM ${localSql(tableName)}`;
    let inserted = 0;
    const chunkSize = 25;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (r) => {
        const payload = {};
        for (const col of commonCols) {
          payload[col] = r[col];
        }
        try {
          if (key && commonCols.includes(key)) {
            await vpsSql`
              INSERT INTO ${vpsSql(tableName)} ${vpsSql(payload)}
              ON CONFLICT (${vpsSql(key)}) DO NOTHING
            `;
          } else {
            await vpsSql`
              INSERT INTO ${vpsSql(tableName)} ${vpsSql(payload)}
              ON CONFLICT DO NOTHING
            `;
          }
          inserted++;
        } catch (err) {
          // Ignore constraint/duplicate
        }
      }));
    }

    const [finalVpsCountRes] = await vpsSql`SELECT count(*) as c FROM ${vpsSql(tableName)}`;
    return { 
      Table: tableName, 
      Local: localCount, 
      VPS: Number(finalVpsCountRes.c), 
      Migrated: inserted, 
      Status: 'Synced' 
    };
  } catch (err) {
    return { Table: tableName, Local: '?', VPS: '?', Migrated: 0, Status: `Error: ${err.message}` };
  }
}

async function run() {
  console.log("==========================================================================================");
  console.log("                 TRANSFER LOCAL DATABASE RECORDS TO VPS PRODUCTION                        ");
  console.log("==========================================================================================\n");

  const tables = [
    { table: 'countries', key: 'id' },
    { table: 'states_provinces', key: 'id' },
    { table: 'districts', key: 'id' },
    { table: 'cities', key: 'id' },
    { table: 'areas_locations', key: 'id' },
    { table: 'ports', key: 'id' },
    { table: 'company_registration_types', key: 'id' },
    { table: 'contact_types', key: 'id' },
    { table: 'document_types', key: 'id' },
    { table: 'account_types', key: 'id' },
    { table: 'tax_codes', key: 'id' },
    { table: 'product_units', key: 'id' },
    { table: 'product_brands', key: 'id' },
    { table: 'product_categories', key: 'id' },
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
    { table: 'account_companies', key: 'id' },
    { table: 'account_customer_owners', key: 'id' },
    { table: 'account_banks', key: 'id' },
    { table: 'account_warehouses', key: 'id' },
    { table: 'customer_contacts', key: 'id' },
    { table: 'customer_registrations', key: 'id' },
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
    { table: 'record_translations', key: 'id' }
  ];

  const results = [];
  for (const item of tables) {
    const res = await syncTable(item.table, item.key);
    console.log(`[SYNC] ${item.table.padEnd(30)} => Local: ${String(res.Local).padStart(5)}, VPS: ${String(res.VPS).padStart(5)}, Migrated: ${String(res.Migrated).padStart(5)} (${res.Status})`);
    results.push(res);
  }

  console.log("\n==========================================================================================");
  console.log("                           MIGRATION COMPLETE AUDIT MATRIX                                ");
  console.log("==========================================================================================");
  console.table(results);

  await localSql.end();
  await vpsSql.end();
}

run().catch(console.error);
