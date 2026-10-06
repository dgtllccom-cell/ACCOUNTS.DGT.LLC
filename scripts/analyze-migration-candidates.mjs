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
  const tables = [
    'purchase_orders',
    'purchase_order_items',
    'purchase_endorsements',
    'purchase_order_endorsements',
    'purchase_loading_records',
    'roznamcha_entries',
    'roznamcha_lines',
    'ledgers',
    'ledger_entries',
    'journal_entries',
    'journal_lines'
  ];

  console.log('=== TABLE AVAILABILITY & ROW COUNTS ===');
  for (const t of tables) {
    const [lExists] = await localSql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${t}`;
    const [vExists] = await vpsSql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${t}`;
    
    let lCount = 0, vCount = 0;
    if (lExists) {
      const [c] = await localSql`SELECT count(*) as c FROM ${localSql(t)}`;
      lCount = Number(c.c);
    }
    if (vExists) {
      const [c] = await vpsSql`SELECT count(*) as c FROM ${vpsSql(t)}`;
      vCount = Number(c.c);
    }
    console.log(`${t.padEnd(30)} -> Local: ${lExists ? lCount : 'MISSING'}, VPS: ${vExists ? vCount : 'MISSING'}`);
  }

  console.log('\n=== ANALYZING LOCAL PURCHASE ORDERS (TEST VS GENUINE) ===');
  const localPOs = await localSql`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE purchase_order_no ILIKE '%LOADTEST%' OR purchase_order_no ILIKE '%DEVTEST%' OR purchase_order_no ILIKE '%TEST%') as test_pos,
      count(*) FILTER (WHERE NOT (purchase_order_no ILIKE '%LOADTEST%' OR purchase_order_no ILIKE '%DEVTEST%' OR purchase_order_no ILIKE '%TEST%')) as genuine_pos
    FROM purchase_orders
  `;
  console.log('Local Purchase Orders breakdown:', localPOs[0]);

  const genuineSamplePOs = await localSql`
    SELECT id, purchase_order_no, super_admin_serial_number, country_id, country_branch_id, city_branch_id, created_at 
    FROM purchase_orders 
    WHERE NOT (purchase_order_no ILIKE '%LOADTEST%' OR purchase_order_no ILIKE '%DEVTEST%' OR purchase_order_no ILIKE '%TEST%')
    ORDER BY created_at ASC
  `;
  console.log(`Genuine POs count: ${genuineSamplePOs.length}`);
  console.log('Genuine POs sample (first 10):', genuineSamplePOs.slice(0, 10));

  console.log('\n=== ANALYZING LOCAL PURCHASE LOADING RECORDS ===');
  const localLoadings = await localSql`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE loading_record_no ILIKE '%LOADTEST%' OR loading_record_no ILIKE '%DEVTEST%' OR loading_record_no ILIKE '%TEST%') as test_records,
      count(*) FILTER (WHERE NOT (loading_record_no ILIKE '%LOADTEST%' OR loading_record_no ILIKE '%DEVTEST%' OR loading_record_no ILIKE '%TEST%')) as genuine_records
    FROM purchase_loading_records
  `;
  console.log('Local Loading Records breakdown:', localLoadings[0]);

  const genuineLoadings = await localSql`
    SELECT id, loading_record_no, purchase_order_id, branch_code, country_branch_id, city_branch_id, created_at 
    FROM purchase_loading_records 
    WHERE NOT (loading_record_no ILIKE '%LOADTEST%' OR loading_record_no ILIKE '%DEVTEST%' OR loading_record_no ILIKE '%TEST%')
    ORDER BY created_at ASC
  `;
  console.log(`Genuine Loading Records count: ${genuineLoadings.length}`);
  console.log('Genuine Loading Records sample:', genuineLoadings.slice(0, 10));

  console.log('\n=== ANALYZING LOCAL ROZNAMCHA ENTRIES ===');
  const localRoz = await localSql`
    SELECT 
      count(*) as total,
      count(*) FILTER (WHERE voucher_no ILIKE '%LOADTEST%' OR voucher_no ILIKE '%DEVTEST%' OR voucher_no ILIKE '%TEST%') as test_roz,
      count(*) FILTER (WHERE NOT (voucher_no ILIKE '%LOADTEST%' OR voucher_no ILIKE '%DEVTEST%' OR voucher_no ILIKE '%TEST%')) as genuine_roz
    FROM roznamcha_entries
  `;
  console.log('Local Roznamcha breakdown:', localRoz[0]);

  const genuineRoz = await localSql`
    SELECT id, voucher_no, super_admin_serial_number, source_module, source_transaction_type, source_transaction_id, country_id, country_branch_id, city_branch_id, created_at 
    FROM roznamcha_entries 
    WHERE NOT (voucher_no ILIKE '%LOADTEST%' OR voucher_no ILIKE '%DEVTEST%' OR voucher_no ILIKE '%TEST%')
    ORDER BY created_at ASC
  `;
  console.log(`Genuine Roznamcha count: ${genuineRoz.length}`);
  console.log('Genuine Roznamcha sample (first 10):', genuineRoz.slice(0, 10));

  console.log('\n=== ANALYZING LOCAL LEDGERS ===');
  const localLedgers = await localSql`
    SELECT id, code, name, currency, opening_balance, current_balance, country_id, country_branch_id, city_branch_id 
    FROM ledgers
    WHERE NOT (code ILIKE '%TEST%' OR name ILIKE '%TEST%')
  `;
  console.log(`Genuine Ledgers count: ${localLedgers.length}`);
  console.log('Genuine Ledgers:', localLedgers);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
