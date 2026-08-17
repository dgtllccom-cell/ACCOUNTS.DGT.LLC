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
const vpsEnv = { DATABASE_URL: 'postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres' };

const localSql = postgres(localEnv.DATABASE_URL, { max: 5 });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 5, ssl: { rejectUnauthorized: false } });

async function syncAndReport(tableName, key = 'id') {
  const localRows = await localSql`SELECT * FROM ${localSql(tableName)}`;
  const vpsCols = await vpsSql`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName}`;
  const vpsColMap = new Map(vpsCols.map(c => [c.column_name, c]));

  console.log(`\n--- Inspecting ${tableName} (Local rows: ${localRows.length}) ---`);
  let successCount = 0;
  let errorCount = 0;
  let firstError = null;

  for (const row of localRows) {
    const payload = {};
    for (const k of Object.keys(row)) {
      if (vpsColMap.has(k)) {
        payload[k] = row[k];
      }
    }

    try {
      if (key && vpsColMap.has(key)) {
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
      successCount++;
    } catch (e) {
      errorCount++;
      if (!firstError) {
        firstError = e.message;
      }
    }
  }

  const [vpsCount] = await vpsSql`SELECT count(*) as c FROM ${vpsSql(tableName)}`;
  console.log(`Result ${tableName}: Success=${successCount}, Errors=${errorCount}, VPS Total=${vpsCount.c}`);
  if (firstError) {
    console.log(`First error on ${tableName}:`, firstError);
  }
}

async function main() {
  await syncAndReport('city_branches');
  await syncAndReport('purchase_orders');
  await syncAndReport('purchase_order_items');
  await syncAndReport('purchase_loading_records');
  await syncAndReport('roznamcha_entries');
  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
