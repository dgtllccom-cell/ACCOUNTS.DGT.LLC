import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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
const vpsEnv = { DATABASE_URL: resolveDbUrl("prod") };

const localSql = postgres(localEnv.DATABASE_URL, { max: 5 });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 5, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=== LOCAL PURCHASE LOADING RECORDS ===');
  const loadingCols = await localSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_loading_records'`;
  console.log('Loading columns:', loadingCols.map(c => c.column_name).join(', '));
  
  const loadingRows = await localSql`SELECT id, loading_record_no, purchase_order_id, created_at FROM purchase_loading_records`;
  console.log(`Total loading records: ${loadingRows.length}`);
  const genuineLoadings = loadingRows.filter(r => !r.loading_record_no?.includes('LOADTEST') && !r.loading_record_no?.includes('DEVTEST') && !r.loading_record_no?.includes('TEST'));
  console.log(`Genuine loading records count: ${genuineLoadings.length}`);
  console.log('Genuine loadings:', genuineLoadings);

  console.log('\n=== LOCAL ROZNAMCHA ENTRIES ===');
  const rozCols = await localSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'roznamcha_entries'`;
  console.log('Roznamcha columns:', rozCols.map(c => c.column_name).join(', '));

  const rozRows = await localSql`SELECT id, voucher_no, super_admin_serial_number, source_module, source_transaction_type, source_transaction_id, created_at FROM roznamcha_entries`;
  console.log(`Total roznamcha entries: ${rozRows.length}`);
  const genuineRoz = rozRows.filter(r => !r.voucher_no?.includes('LOADTEST') && !r.voucher_no?.includes('DEVTEST') && !r.voucher_no?.includes('DEV-01'));
  console.log(`Genuine roznamcha count: ${genuineRoz.length}`);
  console.log('Genuine roznamcha sample:', genuineRoz);

  console.log('\n=== LOCAL ROZNAMCHA LINES FOR GENUINE ROZNAMCHA ===');
  if (genuineRoz.length > 0) {
    const rozIds = genuineRoz.map(r => r.id);
    const lines = await localSql`SELECT * FROM roznamcha_lines WHERE roznamcha_entry_id IN ${localSql(rozIds)}`;
    console.log(`Found ${lines.length} roznamcha lines for genuine entries`);
  }

  console.log('\n=== LOCAL PURCHASE ORDER ITEMS FOR GENUINE POS ===');
  const genuinePoIds = ['19c89541-9aa2-49f6-a2a0-f8528a743007', '52841cd3-c2b7-4f4d-810f-2e301f9450a3', '28e86817-cedd-4780-8941-a8ea0e77bf3a', 'ae1d83ae-3c71-4ed0-a5db-5c7cedc31a7a', 'e52b19cb-4fd5-4153-9f77-7742e6f35d65', '0decf7f0-c111-4c09-9916-b1fdf83a3bd9', '42d5027c-3fdd-40e3-901a-ad416b6e7f6f', '281e379f-5165-4f7f-9033-002bf3f41c96'];
  const poItems = await localSql`SELECT * FROM purchase_order_items WHERE purchase_order_id IN ${localSql(genuinePoIds)}`;
  console.log(`Found ${poItems.length} purchase_order_items for genuine POs`);

  console.log('\n=== VPS EXISTING PURCHASE ORDERS ===');
  const vpsPOs = await vpsSql`SELECT id, purchase_order_no, super_admin_serial_number, created_at FROM purchase_orders`;
  console.log('VPS POs:', vpsPOs);

  console.log('\n=== VPS EXISTING ROZNAMCHA ENTRIES ===');
  const vpsRoz = await vpsSql`SELECT id, voucher_no, super_admin_serial_number, created_at FROM roznamcha_entries`;
  console.log('VPS Roznamcha:', vpsRoz);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
