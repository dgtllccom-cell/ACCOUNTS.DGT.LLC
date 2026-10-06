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
  const localLines = await localSql`
    SELECT DISTINCT rl.ledger_id
    FROM roznamcha_lines rl
    JOIN roznamcha_entries re ON rl.roznamcha_entry_id = re.id
    WHERE re.voucher_no LIKE 'POPAY-%' OR re.voucher_no LIKE 'VCH-SHTR-%'
  `;
  const referencedLedgerIds = localLines.map(r => r.ledger_id).filter(Boolean);
  console.log(`POPAY lines reference ${referencedLedgerIds.length} distinct ledgers`);

  const vpsLedgers = await vpsSql`SELECT id, code, name FROM ledgers`;
  const vpsLedgerIdSet = new Set(vpsLedgers.map(l => l.id));
  const vpsLedgerCodeMap = new Map(vpsLedgers.map(l => [l.code, l.id]));

  const missingLedgers = [];
  for (const id of referencedLedgerIds) {
    if (!vpsLedgerIdSet.has(id)) {
      const [lRow] = await localSql`SELECT * FROM ledgers WHERE id = ${id}`;
      missingLedgers.push(lRow);
    }
  }

  console.log(`Missing ledgers on VPS: ${missingLedgers.length}`);
  for (const m of missingLedgers) {
    console.log(`Missing ledger: id=${m.id}, code=${m.code}, name=${m.name}`);
  }

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
