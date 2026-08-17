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
  console.log("=== COMPREHENSIVE PRODUCTION AUDIT & VERIFICATION ===");

  // 1. Check all roznamcha_lines ledger_id
  const vpsLedgers = new Set((await vpsSql`SELECT id FROM ledgers`).map(l => l.id));
  
  // Re-link any lines from local
  const localLines = await localSql`
    SELECT id, ledger_id 
    FROM roznamcha_lines 
    WHERE roznamcha_entry_id IN (SELECT id FROM roznamcha_entries WHERE voucher_no LIKE 'POPAY-%' OR voucher_no LIKE 'VCH-SHTR-%')
  `;

  let reLinked = 0;
  for (const line of localLines) {
    if (line.ledger_id && vpsLedgers.has(line.ledger_id)) {
      await vpsSql`
        UPDATE roznamcha_lines 
        SET ledger_id = ${line.ledger_id} 
        WHERE id = ${line.id} AND ledger_id IS NULL
      `;
      reLinked++;
    }
  }
  console.log(`Verified / Re-linked ${reLinked} Roznamcha lines to valid Ledgers.`);

  // 2. Full Dr vs Cr balance audit
  const [balanceAudit] = await vpsSql`
    SELECT 
      sum(debit::numeric) as total_debit,
      sum(credit::numeric) as total_credit,
      sum(debit::numeric) - sum(credit::numeric) as net_imbalance,
      count(*) as total_lines
    FROM roznamcha_lines
  `;
  console.log("\nRoznamcha Accounting Balance Audit:", {
    total_debit: balanceAudit.total_debit,
    total_credit: balanceAudit.total_credit,
    net_imbalance: balanceAudit.net_imbalance,
    total_lines: balanceAudit.total_lines
  });

  // 3. Purchase -> Loading -> Roznamcha -> Ledgers relationship chain audit
  const [poCount] = await vpsSql`SELECT count(*) as c FROM purchase_orders`;
  const [poItemsCount] = await vpsSql`SELECT count(*) as c FROM purchase_order_items`;
  const [loadingCount] = await vpsSql`SELECT count(*) as c FROM purchase_loading_records`;
  const [rozCount] = await vpsSql`SELECT count(*) as c FROM roznamcha_entries`;
  const [rozLinesCount] = await vpsSql`SELECT count(*) as c FROM roznamcha_lines`;
  const [ledgersCount] = await vpsSql`SELECT count(*) as c FROM ledgers`;

  console.log("\n=== PRODUCTION DATABASE STATE ===");
  console.log(`- Purchase Orders: ${poCount.c}`);
  console.log(`- Purchase Order Items: ${poItemsCount.c}`);
  console.log(`- Purchase Loading Records: ${loadingCount.c}`);
  console.log(`- Roznamcha Entries: ${rozCount.c}`);
  console.log(`- Roznamcha Lines: ${rozLinesCount.c}`);
  console.log(`- Ledgers: ${ledgersCount.c}`);

  // Sample check on Purchase -> Roznamcha link
  const sampleLinks = await vpsSql`
    SELECT 
      re.voucher_no,
      re.source_module,
      re.source_transaction_type,
      re.super_admin_serial_number,
      po.purchase_order_no
    FROM roznamcha_entries re
    LEFT JOIN purchase_orders po ON re.source_transaction_id = po.id
    WHERE re.source_module = 'purchase' AND re.source_transaction_id IS NOT NULL
    LIMIT 5
  `;
  console.log("\nSample Purchase -> Roznamcha Linkage Chain:", sampleLinks);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
