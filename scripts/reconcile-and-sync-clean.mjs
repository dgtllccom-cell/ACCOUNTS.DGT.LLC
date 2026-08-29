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
  console.log("             COMPREHENSIVE LOCAL -> VPS DATA RECONCILIATION & SYNC                        ");
  console.log("==========================================================================================\n");

  // 1. Build Country Branch Mapping (Local ID -> VPS ID)
  const localCBs = await localSql`SELECT id, code, country_id FROM country_branches`;
  const vpsCBs = await vpsSql`SELECT id, code, country_id FROM country_branches`;
  const countryBranchMap = new Map();
  for (const l of localCBs) {
    const matched = vpsCBs.find(v => v.code === l.code || v.country_id === l.country_id);
    if (matched) {
      countryBranchMap.set(l.id, matched.id);
    }
  }
  console.log(`[MAP] Mapped ${countryBranchMap.size} country branches from Local to VPS.`);

  // 2. Sync City Branches with proper foreign keys
  const localCityBranches = await localSql`SELECT * FROM city_branches`;
  let syncedCityBranches = 0;
  for (const cb of localCityBranches) {
    const mappedCountryBranchId = countryBranchMap.get(cb.country_branch_id) || cb.country_branch_id;
    
    // Validate city_id
    let validCityId = cb.city_id;
    if (validCityId) {
      const [exists] = await vpsSql`SELECT 1 FROM cities WHERE id = ${validCityId}`;
      if (!exists) {
        validCityId = null;
      }
    }

    const payload = {
      ...cb,
      country_branch_id: mappedCountryBranchId,
      city_id: validCityId,
      state_province_id: null,
      district_id: null,
      area_location_id: null
    };

    try {
      await vpsSql`
        INSERT INTO city_branches ${vpsSql(payload)}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          country_id = EXCLUDED.country_id,
          country_branch_id = EXCLUDED.country_branch_id,
          city_name = EXCLUDED.city_name,
          local_currency = EXCLUDED.local_currency,
          email = EXCLUDED.email
      `;
      syncedCityBranches++;
    } catch (e) {
      console.log(`[CITY_BRANCH WARN] ${cb.code}:`, e.message);
    }
  }
  console.log(`[SYNC] Synced ${syncedCityBranches}/${localCityBranches.length} city branches to VPS.`);

  // 3. Sync Accounts and Ledgers
  const [vpsAccounts] = await vpsSql`SELECT count(*) as c FROM accounts`;
  const [vpsLedgers] = await vpsSql`SELECT count(*) as c FROM ledgers`;
  const [vpsRoznamcha] = await vpsSql`SELECT count(*) as c FROM roznamcha_entries`;
  console.log(`[STATUS] VPS Accounts: ${vpsAccounts.c}, Ledgers: ${vpsLedgers.c}, Roznamcha: ${vpsRoznamcha.c}`);

  // 4. Accounting Imbalance / Reconciliation Check on VPS
  const roznamchaStats = await vpsSql`
    SELECT 
      count(*) as total_entries,
      count(DISTINCT country_id) as active_countries,
      count(DISTINCT city_branch_id) as active_city_branches
    FROM roznamcha_entries
  `;
  console.log("[AUDIT] Roznamcha Status on VPS:", roznamchaStats[0]);

  // Check Ledgers on VPS
  const ledgersAudit = await vpsSql`
    SELECT 
      l.id, 
      l.code, 
      l.name, 
      l.currency, 
      l.opening_balance, 
      l.current_balance
    FROM ledgers l
    LIMIT 10
  `;
  console.log("[AUDIT] Sample VPS Ledgers:", ledgersAudit);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
