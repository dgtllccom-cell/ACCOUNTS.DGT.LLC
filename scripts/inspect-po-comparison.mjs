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

async function main() {
  const localPOs = await localSql`
    SELECT * 
    FROM purchase_orders 
    WHERE NOT (purchase_order_no ILIKE '%LOADTEST%' OR purchase_order_no ILIKE '%DEVTEST%')
  `;
  console.log(`Local genuine POs (${localPOs.length}):`, localPOs.map(p => ({ id: p.id, no: p.purchase_order_no, serial: p.super_admin_serial_number })));

  const vpsPOs = await vpsSql`
    SELECT * 
    FROM purchase_orders
  `;
  console.log(`VPS POs (${vpsPOs.length}):`, vpsPOs.map(p => ({ id: p.id, no: p.purchase_order_no, serial: p.super_admin_serial_number })));

  const vpsPoNos = new Set(vpsPOs.map(p => p.purchase_order_no));
  const missingPOs = localPOs.filter(p => !vpsPoNos.has(p.purchase_order_no));
  console.log(`POs in Local not in VPS (${missingPOs.length}):`, missingPOs.map(p => p.purchase_order_no));

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
