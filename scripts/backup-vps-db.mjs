import fs from 'node:fs';
import postgres from 'postgres';

const vpsEnv = { DATABASE_URL: 'postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' };
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 5, ssl: { rejectUnauthorized: false } });

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = './backups';
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupPath = `${backupDir}/vps-snapshot-${timestamp}.json`;
  console.log(`[BACKUP] Creating VPS Database Recovery Snapshot at: ${backupPath}...`);

  const tables = [
    'countries',
    'country_branches',
    'city_branches',
    'companies',
    'banks',
    'accounts',
    'ledgers',
    'customers',
    'employees',
    'purchase_orders',
    'purchase_order_items',
    'purchase_loading_records',
    'roznamcha_entries',
    'sales_orders'
  ];

  const backupData = {};
  for (const table of tables) {
    try {
      const rows = await vpsSql`SELECT * FROM ${vpsSql(table)}`;
      backupData[table] = rows;
      console.log(`[BACKUP] Saved table ${table.padEnd(25)} (${rows.length} rows)`);
    } catch (e) {
      console.warn(`[BACKUP WARN] Table ${table}: ${e.message}`);
    }
  }

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[BACKUP] Successfully created recovery snapshot with ${Object.keys(backupData).length} tables!`);
  await vpsSql.end();
}

main().catch(console.error);
