import fs from "node:fs";
import postgres from "postgres";

const TARGET_REF = "csesvyxxjivnkkozgopt";
const PROD_REF = "inmayhrxucimxqhgseqi";
const DEFAULT_SOURCE_TAG = "LOCAL-LOADTEST-AUG2026-R01";

function loadEnv() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!env[key]) env[key] = value;
    }
  }
  return env;
}

function extractSupabaseRef(url) {
  if (!url) return null;
  const match = String(url).match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?/i);
  return match?.[1] ?? null;
}

function normalBalanceForKind(kind) {
  return kind === "asset" || kind === "expense" ? "debit" : "credit";
}

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) {
    args.set(token.slice(2), "true");
  } else {
    args.set(token.slice(2), next);
    i += 1;
  }
}

const confirmLocalDev = args.get("confirm-local-dev") === "true";
const sourceTag = args.get("source-tag") || DEFAULT_SOURCE_TAG;
const env = loadEnv();

if (!confirmLocalDev) {
  throw new Error("Missing --confirm-local-dev. Refusing to seed load-test ledgers.");
}
if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
  throw new Error("Refusing to seed load-test ledgers in production-like mode.");
}
if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const ref = extractSupabaseRef(env.NEXT_PUBLIC_SUPABASE_URL || "");
const prodRef = env.PROD_SUPABASE_REF || PROD_REF;
const devRef = env.DEV_SUPABASE_REF || TARGET_REF;

if (ref !== TARGET_REF) {
  throw new Error(`Supabase ref mismatch: expected ${TARGET_REF}, got ${ref ?? "null"}.`);
}
if (ref === prodRef || env.DATABASE_URL.includes(prodRef)) {
  throw new Error(`Ref ${ref} matches production ref ${prodRef}; refusing to proceed.`);
}
if (devRef !== TARGET_REF) {
  throw new Error(`DEV_SUPABASE_REF mismatch: expected ${TARGET_REF}, got ${devRef}.`);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

function countryCurrency(countryName, iso2) {
  const code = String(iso2 || "").toUpperCase();
  if (code === "AE" || /emirates/i.test(countryName)) return "AED";
  if (code === "PK" || /pakistan/i.test(countryName)) return "PKR";
  if (code === "AF" || /afghanistan/i.test(countryName)) return "AFN";
  if (code === "IN" || /india/i.test(countryName)) return "INR";
  return "USD";
}

async function createEnterpriseAccount(tx, { scope, countryId, code, name, kind, currency, serial, branchCode, sequence, countrySerial, branchSerial, sourceTag }) {
  const existing = await tx`
    select id
    from enterprise_accounts
    where scope = ${scope}::ledger_scope
      and coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${countryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      and code = ${code}
      and deleted_at is null
    limit 1
  `;
  if (existing[0]) return existing[0].id;

  const inserted = await tx`
    insert into enterprise_accounts (
      scope, country_id, country_branch_id, city_branch_id, parent_id,
      code, account_number, customer_number, account_serial_number, creation_date,
      branch_code, branch_account_sequence, country_serial_number, branch_serial_number,
      manual_reference_number, name, kind, currency, opening_balance, current_balance,
      status, is_control_account, created_at, updated_at
    ) values (
      ${scope}::ledger_scope,
      ${countryId}::uuid,
      null,
      null,
      null,
      ${code},
      ${`${code}-ACCT`},
      ${`${code}-CUST`},
      ${BigInt(serial)},
      now(),
      ${branchCode},
      ${BigInt(sequence)},
      ${countrySerial},
      ${branchSerial},
      ${`${sourceTag}-${code}`},
      ${name},
      ${kind}::account_kind,
      ${currency},
      0,
      0,
      'active'::account_status,
      false,
      now(),
      now()
    )
    returning id
  `;
  return inserted[0].id;
}

async function createLedger(tx, { scope, countryId, enterpriseAccountId, code, name, currency, kind }) {
  const existing = await tx`
    select id
    from ledgers
    where scope = ${scope}::ledger_scope
      and coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${countryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      and code = ${code}
      and deleted_at is null
    limit 1
  `;
  if (existing[0]) return existing[0].id;

  const inserted = await tx`
    insert into ledgers (
      scope, country_id, country_branch_id, city_branch_id, enterprise_account_id, parent_ledger_id,
      code, name, currency, opening_balance, current_balance, debit_total, credit_total,
      normal_balance, is_active, created_at, updated_at
    ) values (
      ${scope}::ledger_scope,
      ${countryId}::uuid,
      null,
      null,
      ${enterpriseAccountId}::uuid,
      null,
      ${code},
      ${name},
      ${currency},
      0,
      0,
      0,
      0,
      ${normalBalanceForKind(kind)}::ledger_direction,
      true,
      now(),
      now()
    )
    returning id
  `;
  return inserted[0].id;
}

try {
  console.log("=======================================================================");
  console.log("  LOADTEST LEDGER MASTER SEED");
  console.log("=======================================================================");
  console.log(`  Target ref: ${ref}`);
  console.log(`  Source tag: ${sourceTag}`);
  console.log(`  Database: ${env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@")}`);

  const countries = await sql`
    select id, name, coalesce(nullif(iso2, ''), nullif(iso3, '')) as iso2
    from countries
    where deleted_at is null
      and name in ('United Arab Emirates', 'Pakistan', 'Afghanistan', 'India')
    order by name
  `;
  if (countries.length === 0) throw new Error("No target countries found.");

  const summary = [];
  for (const country of countries) {
    const currency = countryCurrency(country.name, country.iso2);
    const countrySlug = String(country.iso2 || country.name.slice(0, 2)).toUpperCase();
    await sql.begin(async (tx) => {
      const specs = [
        { code: "PURCHASE", name: `DEV TEST ${countrySlug} Purchase Ledger [${sourceTag}]`, kind: "expense", suffix: "Purchase" },
        { code: "CASH", name: `DEV TEST ${countrySlug} Cash Ledger [${sourceTag}]`, kind: "asset", suffix: "Cash" },
        { code: "BANK", name: `DEV TEST ${countrySlug} Bank Ledger [${sourceTag}]`, kind: "asset", suffix: "Bank" },
        { code: "PAYABLE", name: `DEV TEST ${countrySlug} Accounts Payable Ledger [${sourceTag}]`, kind: "liability", suffix: "Payable" },
        { code: "RECEIVABLE", name: `DEV TEST ${countrySlug} Accounts Receivable Ledger [${sourceTag}]`, kind: "asset", suffix: "Receivable" }
      ];

      const counts = { created: 0, skipped: 0 };
      for (const spec of specs) {
        const accountId = await createEnterpriseAccount(tx, {
          scope: "country",
          countryId: country.id,
          code: `LOADTEST-${countrySlug}-${spec.code}`,
          name: `DEV TEST ${countrySlug} ${spec.suffix} Account [${sourceTag}]`,
          kind: spec.kind,
          currency,
          serial: Number(`${countries.indexOf(country) + 1}${String(specs.indexOf(spec) + 1).padStart(2, "0")}01`),
          branchCode: countrySlug,
          sequence: specs.indexOf(spec) + 1,
          countrySerial: `${countrySlug}-${sourceTag}-${spec.code}`,
          branchSerial: `${countrySlug}-${sourceTag}-${spec.code}`,
          sourceTag
        });
        const before = await tx`
          select id
          from ledgers
          where scope = 'country'::ledger_scope
            and country_id = ${country.id}
            and code = ${`LOADTEST-${countrySlug}-${spec.code}`}
            and deleted_at is null
          limit 1
        `;
        if (before[0]) {
          counts.skipped += 1;
          continue;
        }
        await createLedger(tx, {
          scope: "country",
          countryId: country.id,
          enterpriseAccountId: accountId,
          code: `LOADTEST-${countrySlug}-${spec.code}`,
          name: spec.name,
          currency,
          kind: spec.kind
        });
        counts.created += 1;
      }

      summary.push({
        country: country.name,
        currency,
        created: counts.created,
        skipped: counts.skipped
      });
    });
  }

  console.table(summary);
  console.log("Cleanup path:");
  console.log(`  scripts/cleanup-loadtest-ledgers.mjs --confirm-local-dev --source-tag ${sourceTag}`);
  console.log("Access note:");
  console.log("  These are DEV TEST country-scoped ledgers only and are labeled for temporary load testing.");
  await sql.end({ timeout: 10 });
} catch (error) {
  console.error("[LEDGER SEED] Failed:", error?.message || error);
  if (error?.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
}
