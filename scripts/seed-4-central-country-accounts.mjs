import fs from "node:fs";
import crypto from "node:crypto";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    }
  } catch (e) {
    console.error("Could not read .env.local", e);
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

const CENTRAL_ACCOUNTS = [
  {
    countryCode: "AE",
    countryIso3: "ARE",
    countryName: "United Arab Emirates",
    currency: "AED",
    accountCode: "UAE-CORP-GEN-001",
    manualRef: "0001-UAE-HUB",
    customerNumber: "CUST-UAE-0001",
    nameEn: "UAE Central Inter-Country & Maritime Clearing Account"
  },
  {
    countryCode: "PK",
    countryIso3: "PAK",
    countryName: "Pakistan",
    currency: "PKR",
    accountCode: "PAK-CORP-GEN-001",
    manualRef: "0002-PAK-HUB",
    customerNumber: "CUST-PAK-0001",
    nameEn: "Pakistan Inter-Country & Port Clearing General Account"
  },
  {
    countryCode: "AF",
    countryIso3: "AFG",
    countryName: "Afghanistan",
    currency: "AFN",
    accountCode: "AFG-CORP-GEN-001",
    manualRef: "0003-AFG-HUB",
    customerNumber: "CUST-AFG-0001",
    nameEn: "Afghanistan Transit & Inter-Country General Account"
  },
  {
    countryCode: "IR",
    countryIso3: "IRN",
    countryName: "Iran",
    currency: "IRR",
    accountCode: "IRN-CORP-GEN-001",
    manualRef: "0004-IRN-HUB",
    customerNumber: "CUST-IRN-0001",
    nameEn: "Iran Regional Transit & Sea-Port Clearing Account"
  }
];

async function fixLedgers() {
  console.log("🚀 Creating linked ledgers for the 4 central country accounts...");

  for (const acc of CENTRAL_ACCOUNTS) {
    try {
      const eaRows = await sql`
        select id, country_id, code, name, currency from public.enterprise_accounts
        where code = ${acc.accountCode}
        limit 1
      `;
      if (eaRows.length === 0) {
        console.log(`   ⚠️ Enterprise account not found for ${acc.accountCode}`);
        continue;
      }

      const ea = eaRows[0];
      const ledgerRows = await sql`
        select id from public.ledgers
        where enterprise_account_id = ${ea.id} or code = ${ea.code}
        limit 1
      `;

      if (ledgerRows.length === 0) {
        await sql`
          insert into public.ledgers (
            id, enterprise_account_id, country_id, scope, code, name, currency, is_active, created_at, updated_at
          ) values (
            ${crypto.randomUUID()}, ${ea.id}, ${ea.country_id}, 'country', ${ea.code}, ${ea.name}, ${ea.currency}, true, now(), now()
          )
        `;
        console.log(`   ✅ Created Ledger for ${ea.code} - ${ea.name}`);
      } else {
        await sql`
          update public.ledgers set
            name = ${ea.name},
            currency = ${ea.currency},
            scope = 'country',
            country_id = ${ea.country_id},
            is_active = true,
            updated_at = now()
          where id = ${ledgerRows[0].id}
        `;
        console.log(`   🔄 Updated Ledger for ${ea.code} - ${ea.name}`);
      }
    } catch (e) {
      console.error(`   ❌ Ledger error for ${acc.accountCode}:`, e.message);
    }
  }

  console.log("🎉 All 4 Ledgers linked and active!");
  await sql.end();
}

fixLedgers();
