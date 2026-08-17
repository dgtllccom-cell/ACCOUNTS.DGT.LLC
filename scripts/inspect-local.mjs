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
const localSql = postgres(localEnv.DATABASE_URL, { max: 5 });

async function main() {
  const localPO = await localSql`SELECT id, purchase_order_no, super_admin_serial_number FROM purchase_orders LIMIT 15`;
  console.log('Local POs sample:', localPO);
  const localRoz = await localSql`SELECT id, voucher_no, super_admin_serial_number FROM roznamcha_entries LIMIT 15`;
  console.log('Local Roznamcha sample:', localRoz);
  await localSql.end();
}

main().catch(console.error);
