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

const localSql = postgres(localEnv.DATABASE_URL, { max: 10, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 15, prepare: false, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("==========================================================================================");
  console.log("             FINAL CLEANUP & RESYNC OF REMAINING CANDIDATE RECORDS                        ");
  console.log("==========================================================================================\n");

  // 1. Sync Missing Ledgers (Filtering columns strictly to VPS columns)
  const vpsLedgerCols = (await vpsSql`SELECT column_name FROM information_schema.columns WHERE table_name = 'ledgers'`).map(c => c.column_name);
  const vpsLedgerColSet = new Set(vpsLedgerCols);

  const localCBs = await localSql`SELECT id, code, country_id FROM country_branches`;
  const vpsCBs = await vpsSql`SELECT id, code, country_id FROM country_branches`;
  const countryBranchMap = new Map();
  for (const l of localCBs) {
    const matched = vpsCBs.find(v => v.code === l.code || v.country_id === l.country_id);
    if (matched) countryBranchMap.set(l.id, matched.id);
  }

  const candidateLedgerCodes = ['UAE-DUB-AC-0001', 'UAE-DUB-AC-0002', 'UAE-DUB-AC-0003'];
  const localLedgers = await localSql`SELECT * FROM ledgers WHERE code IN ${localSql(candidateLedgerCodes)}`;

  for (const l of localLedgers) {
    const mappedCountryBranchId = countryBranchMap.get(l.country_branch_id) || l.country_branch_id;
    const payload = {};
    for (const col of vpsLedgerCols) {
      if (col in l) {
        payload[col] = l[col];
      }
    }
    payload.country_branch_id = mappedCountryBranchId;

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
      console.warn(`  ! Ledger error ${l.code}:`, e.message);
    }
  }

  // 2. Migrate remaining PO (PO-1786650562393) with clean country serial
  const remainingPoNo = 'PO-1786650562393';
  const [po] = await localSql`SELECT * FROM purchase_orders WHERE purchase_order_no = ${remainingPoNo}`;
  if (po) {
    const mappedCountryBranchId = countryBranchMap.get(po.country_branch_id) || po.country_branch_id;
    
    // Allocate next conflict-free country serial
    const maxCountrySerial = await vpsSql`
      SELECT max(NULLIF(regexp_replace(country_transaction_serial_number, '\\D', '', 'g'), '')::int) as max_c 
      FROM purchase_orders 
      WHERE country_id = ${po.country_id}
    `;
    const nextCountrySerialNum = (Number(maxCountrySerial[0]?.max_c) || 10) + 1;
    const nextCountrySerial = `UAE-${String(nextCountrySerialNum).padStart(6, '0')}`;

    const maxAdminSerial = await vpsSql`
      SELECT max(NULLIF(regexp_replace(super_admin_serial_number, '\\D', '', 'g'), '')::int) as max_s 
      FROM purchase_orders
    `;
    const nextAdminSerialNum = (Number(maxAdminSerial[0]?.max_s) || 17) + 1;
    const nextAdminSerial = String(nextAdminSerialNum).padStart(8, '0');

    const vpsProfileIds = new Set((await vpsSql`SELECT id FROM profiles`).map(p => p.id));
    let validSupplierCompanyId = po.supplier_company_id;
    if (validSupplierCompanyId) {
      const [cExists] = await vpsSql`SELECT 1 FROM companies WHERE id = ${validSupplierCompanyId}`;
      if (!cExists) validSupplierCompanyId = null;
    }

    const payload = {
      ...po,
      country_branch_id: mappedCountryBranchId,
      supplier_company_id: validSupplierCompanyId,
      created_by: vpsProfileIds.has(po.created_by) ? po.created_by : null,
      country_transaction_serial_number: nextCountrySerial,
      branch_transaction_serial_number: `DEV-${String(nextCountrySerialNum).padStart(6, '0')}`,
      super_admin_serial_number: nextAdminSerial
    };

    try {
      await vpsSql`
        INSERT INTO purchase_orders ${vpsSql(payload)}
        ON CONFLICT (id) DO NOTHING
      `;
      console.log(`  ✓ Inserted remaining PO: ${po.purchase_order_no} (Country Serial: ${nextCountrySerial})`);

      const items = await localSql`SELECT * FROM purchase_order_items WHERE purchase_order_id = ${po.id}`;
      for (const item of items) {
        await vpsSql`
          INSERT INTO purchase_order_items ${vpsSql(item)}
          ON CONFLICT (id) DO NOTHING
        `;
      }
    } catch (e) {
      console.warn(`  ! Error inserting PO ${po.purchase_order_no}:`, e.message);
    }
  }

  // 3. Migrate remaining 5 Roznamcha entries with clean country serials
  const vpsExistingVouchers = new Set((await vpsSql`SELECT voucher_no FROM roznamcha_entries`).map(r => r.voucher_no));
  const remainingRoz = await localSql`
    SELECT * FROM roznamcha_entries 
    WHERE voucher_no LIKE 'POPAY-%' OR voucher_no LIKE 'VCH-SHTR-%'
  `;
  const rozToMigrate = remainingRoz.filter(r => !vpsExistingVouchers.has(r.voucher_no));
  console.log(`Remaining Roznamcha entries to migrate: ${rozToMigrate.length}`);

  const vpsProfileIds = new Set((await vpsSql`SELECT id FROM profiles`).map(p => p.id));
  const maxRozSerialRow = await vpsSql`
    SELECT max(NULLIF(regexp_replace(super_admin_serial_number, '\\D', '', 'g'), '')::int) as max_s 
    FROM roznamcha_entries
  `;
  let currentRozSerial = Number(maxRozSerialRow[0]?.max_s || 237);

  const maxCountrySerialRow = await vpsSql`
    SELECT max(NULLIF(regexp_replace(country_transaction_serial_number, '\\D', '', 'g'), '')::int) as max_c 
    FROM roznamcha_entries
  `;
  let currentCountrySerial = Number(maxCountrySerialRow[0]?.max_c || 237);

  for (const roz of rozToMigrate) {
    currentRozSerial++;
    currentCountrySerial++;

    const newSuperSerial = `SA-${String(currentRozSerial).padStart(6, '0')}`;
    const newCountrySerial = `UAE-${String(currentCountrySerial).padStart(6, '0')}`;
    const mappedCountryBranchId = countryBranchMap.get(roz.country_branch_id) || roz.country_branch_id;

    let validSourceId = roz.source_transaction_id;
    if (validSourceId && roz.source_module === 'purchase') {
      const [poExists] = await vpsSql`SELECT 1 FROM purchase_orders WHERE id = ${validSourceId}`;
      if (!poExists) validSourceId = null;
    }

    const payload = {
      ...roz,
      country_branch_id: mappedCountryBranchId,
      source_transaction_id: validSourceId,
      created_by: vpsProfileIds.has(roz.created_by) ? roz.created_by : null,
      approved_by: vpsProfileIds.has(roz.approved_by) ? roz.approved_by : null,
      super_admin_serial_number: newSuperSerial,
      country_transaction_serial_number: newCountrySerial,
      branch_transaction_serial_number: `DEV-${String(currentCountrySerial).padStart(6, '0')}`,
      main_branch_transaction_serial: `MAIN-${String(currentCountrySerial).padStart(6, '0')}`,
      city_branch_transaction_serial: `DEV-${String(currentCountrySerial).padStart(6, '0')}`
    };

    try {
      await vpsSql`
        INSERT INTO roznamcha_entries ${vpsSql(payload)}
        ON CONFLICT (id) DO NOTHING
      `;
      console.log(`  ✓ Inserted Roznamcha: ${roz.voucher_no} (${newSuperSerial})`);

      const lines = await localSql`SELECT * FROM roznamcha_lines WHERE roznamcha_entry_id = ${roz.id}`;
      for (const line of lines) {
        let validLedgerId = line.ledger_id;
        if (validLedgerId) {
          const [lExists] = await vpsSql`SELECT 1 FROM ledgers WHERE id = ${validLedgerId}`;
          if (!lExists) validLedgerId = null;
        }

        const linePayload = {
          ...line,
          ledger_id: validLedgerId,
          super_admin_serial_number: newSuperSerial,
          country_transaction_serial_number: newCountrySerial,
          branch_transaction_serial_number: `DEV-${String(currentCountrySerial).padStart(6, '0')}`,
          main_branch_transaction_serial: `MAIN-${String(currentCountrySerial).padStart(6, '0')}`,
          city_branch_transaction_serial: `DEV-${String(currentCountrySerial).padStart(6, '0')}`
        };

        await vpsSql`
          INSERT INTO roznamcha_lines ${vpsSql(linePayload)}
          ON CONFLICT (id) DO NOTHING
        `;
      }
    } catch (e) {
      console.warn(`  ! Error inserting Roznamcha ${roz.voucher_no}:`, e.message);
    }
  }

  // 4. Final Balance & Count Verification
  console.log('\n=== FINAL RECONCILIATION SUMMARY ON PRODUCTION VPS ===');
  const [vpsLedgersCount] = await vpsSql`SELECT count(*) as c FROM ledgers`;
  const [vpsPOsCount] = await vpsSql`SELECT count(*) as c FROM purchase_orders`;
  const [vpsPoItemsCount] = await vpsSql`SELECT count(*) as c FROM purchase_order_items`;
  const [vpsRozCount] = await vpsSql`SELECT count(*) as c FROM roznamcha_entries`;
  const [vpsRozLinesCount] = await vpsSql`SELECT count(*) as c FROM roznamcha_lines`;
  const [balanceAudit] = await vpsSql`
    SELECT 
      sum(debit::numeric) as total_debit,
      sum(credit::numeric) as total_credit,
      sum(debit::numeric) - sum(credit::numeric) as net_imbalance,
      count(*) as total_lines
    FROM roznamcha_lines
  `;

  console.log(`Ledgers Total: ${vpsLedgersCount.c}`);
  console.log(`Purchase Orders Total: ${vpsPOsCount.c}`);
  console.log(`Purchase Order Items Total: ${vpsPoItemsCount.c}`);
  console.log(`Roznamcha Entries Total: ${vpsRozCount.c}`);
  console.log(`Roznamcha Lines Total: ${vpsRozLinesCount.c}`);
  console.log(`Accounting Net Imbalance (Dr - Cr): ${balanceAudit.net_imbalance} (Total lines: ${balanceAudit.total_lines})`);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
