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
  const vpsLedgerCols = (await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'ledgers'`).map(c => c.column_name);
  const candidateLedgerCodes = ['UAE-DUB-AC-0001', 'UAE-DUB-AC-0002', 'UAE-DUB-AC-0003'];
  const localLedgers = await localSql`SELECT * FROM ledgers WHERE code IN ${localSql(candidateLedgerCodes)}`;

  const localCBs = await localSql`SELECT id, code, country_id FROM country_branches`;
  const vpsCBs = await vpsSql`SELECT id, code, country_id FROM country_branches`;
  const countryBranchMap = new Map();
  for (const l of localCBs) {
    const matched = vpsCBs.find(v => v.code === l.code || v.country_id === l.country_id);
    if (matched) countryBranchMap.set(l.id, matched.id);
  }

  const vpsEntAccounts = new Set((await vpsSql`SELECT id FROM enterprise_accounts`).map(e => e.id));

  for (const l of localLedgers) {
    const mappedCountryBranchId = countryBranchMap.get(l.country_branch_id) || l.country_branch_id;
    const payload = {};
    for (const col of vpsLedgerCols) {
      if (col in l) {
        payload[col] = l[col];
      }
    }
    payload.country_branch_id = mappedCountryBranchId;
    payload.created_by = null;
    if (payload.enterprise_account_id && !vpsEntAccounts.has(payload.enterprise_account_id)) {
      payload.enterprise_account_id = null;
    }

    try {
      await vpsSql`
        INSERT INTO ledgers ${vpsSql(payload)}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          country_branch_id = EXCLUDED.country_branch_id,
          currency = EXCLUDED.currency
      `;
      console.log(`  ✓ Synced ledger: ${l.code} (${l.name})`);
    } catch (e) {
      console.warn(`  ! Error on ledger ${l.code}:`, e.message);
    }
  }

  const [count] = await vpsSql`SELECT count(*) as c FROM ledgers`;
  console.log(`Total Ledgers on VPS: ${count.c}`);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
