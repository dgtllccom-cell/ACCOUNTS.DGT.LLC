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
  const vouchers = await localSql`
    SELECT id, voucher_no, narration, created_at 
    FROM roznamcha_entries 
    ORDER BY created_at ASC
  `;
  console.log(`Total vouchers: ${vouchers.length}`);
  
  // Group by voucher pattern
  const patterns = {};
  for (const v of vouchers) {
    const prefix = v.voucher_no.split('-').slice(0, 2).join('-');
    patterns[prefix] = (patterns[prefix] || 0) + 1;
  }
  console.log('Voucher patterns:', patterns);

  console.log('\nSample of each pattern:');
  const seen = new Set();
  for (const v of vouchers) {
    const prefix = v.voucher_no.split('-').slice(0, 2).join('-');
    if (!seen.has(prefix)) {
      seen.add(prefix);
      console.log(`[${prefix}] sample:`, v.voucher_no, '|', v.narration);
    }
  }

  await localSql.end();
}

main().catch(console.error);
