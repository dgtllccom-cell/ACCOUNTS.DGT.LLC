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
  const localCols = await localSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'roznamcha_lines'`;
  console.log('Local roznamcha_lines columns:', localCols.map(c => c.column_name).join(', '));

  const vpsCols = await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'roznamcha_lines'`;
  console.log('VPS roznamcha_lines columns:', vpsCols.map(c => c.column_name).join(', '));

  const sample = await localSql`
    SELECT * 
    FROM roznamcha_lines 
    WHERE roznamcha_entry_id IN (
      SELECT id FROM roznamcha_entries 
      WHERE NOT (voucher_no ILIKE '%LOADTEST%' OR voucher_no ILIKE '%DEVTEST%' OR voucher_no ILIKE '%DEV-01%')
    )
    LIMIT 3
  `;
  console.log('Sample genuine roznamcha_lines in local:', sample);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
