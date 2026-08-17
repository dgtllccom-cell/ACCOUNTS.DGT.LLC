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
  const localPopays = await localSql`
    SELECT * 
    FROM roznamcha_entries 
    WHERE voucher_no LIKE 'POPAY-%' OR voucher_no LIKE 'VCH-SHTR-%'
  `;
  console.log(`Found ${localPopays.length} POPAY/SHTR entries in local`);

  const vpsVouchers = new Set((await vpsSql`SELECT voucher_no FROM roznamcha_entries`).map(r => r.voucher_no));
  console.log(`VPS already has vouchers:`, Array.from(vpsVouchers));

  const toMigrate = localPopays.filter(r => !vpsVouchers.has(r.voucher_no));
  console.log(`POPAY/SHTR entries to migrate to VPS: ${toMigrate.length}`);

  // Check unique constraints on serials on VPS
  const vpsSuperSerials = new Set((await vpsSql`SELECT super_admin_serial_number FROM roznamcha_entries WHERE super_admin_serial_number IS NOT NULL`).map(r => r.super_admin_serial_number));
  console.log('VPS existing super_admin_serial_numbers:', Array.from(vpsSuperSerials));

  const serialConflicts = toMigrate.filter(r => r.super_admin_serial_number && vpsSuperSerials.has(r.super_admin_serial_number));
  console.log(`Serial conflicts count: ${serialConflicts.length}`);
  if (serialConflicts.length > 0) {
    console.log('Conflicting serials sample:', serialConflicts.slice(0, 5).map(r => ({ id: r.id, voucher: r.voucher_no, serial: r.super_admin_serial_number })));
  }

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
