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
  const localCB = await localSql`SELECT * FROM city_branches`;
  console.log(`Found ${localCB.length} city_branches in local`);
  
  for (const cb of localCB) {
    // Check if city_id exists in VPS cities
    let validCityId = cb.city_id;
    if (validCityId) {
      const [exists] = await vpsSql`SELECT 1 FROM cities WHERE id = ${validCityId}`;
      if (!exists) {
        // Find matching city by name or set to null
        const [match] = await vpsSql`SELECT id FROM cities WHERE lower(name) = lower(${cb.city_name}) AND country_id = ${cb.country_id} LIMIT 1`;
        validCityId = match ? match.id : null;
      }
    }

    const payload = {
      ...cb,
      city_id: validCityId
    };

    try {
      await vpsSql`
        INSERT INTO city_branches ${vpsSql(payload)}
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          country_id = EXCLUDED.country_id,
          country_branch_id = EXCLUDED.country_branch_id,
          local_currency = EXCLUDED.local_currency,
          city_name = EXCLUDED.city_name,
          city_id = EXCLUDED.city_id
      `;
      console.log(`Synced city_branch: ${cb.code} - ${cb.name}`);
    } catch (e) {
      console.error(`Error syncing city_branch ${cb.code}:`, e.message);
    }
  }

  const [count] = await vpsSql`SELECT count(*) as c FROM city_branches`;
  console.log(`Total city_branches on VPS: ${count.c}`);

  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
