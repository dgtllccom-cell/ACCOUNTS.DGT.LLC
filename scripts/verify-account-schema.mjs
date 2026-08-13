import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  console.log("=== ACCOUNT SCHEMA VERIFICATION ===\n");

  // Check all junction tables exist
  const tables = ['account_companies', 'account_banks', 'account_warehouses', 'account_customer_owners'];

  for (const table of tables) {
    const result = await sql`
      SELECT EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=${table}) as exists;
    `;
    console.log(`${table}: ${result[0].exists ? '✓ EXISTS' : '✗ MISSING'}`);
  }

  // Check account_type_id and is_active columns
  console.log("\nAccounts Table Extensions:");
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='accounts'
    AND column_name IN ('account_type_id', 'is_active');
  `;
  console.log(`account_type_id: ${cols.find(c => c.column_name === 'account_type_id') ? '✓' : '✗'}`);
  console.log(`is_active: ${cols.find(c => c.column_name === 'is_active') ? '✓' : '✗'}`);

  // Check indexes
  console.log("\nIndexes:");
  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND indexname LIKE 'idx_account%';
  `;
  console.log(`Found ${indexes.length} account-related indexes`);

  // Check for existing account records
  console.log("\nExisting Accounts:");
  const accounts = await sql`SELECT COUNT(*) as count FROM public.accounts;`;
  console.log(`Total accounts in database: ${accounts[0].count}`);

  // Check for translations
  console.log("\nTranslations for Accounts:");
  const translations = await sql`
    SELECT COUNT(*) as count FROM record_translations WHERE record_table='accounts';
  `;
  console.log(`Translation records: ${translations[0].count}`);

  console.log("\n=== SCHEMA VERIFICATION COMPLETE ===");
  process.exit(0);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
