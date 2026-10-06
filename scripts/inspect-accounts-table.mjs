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

function loadEnv() {
  return { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  console.log("Checking accounts table...\n");

  // Check if table exists and get columns
  const columns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts'
    ORDER BY ordinal_position;
  `;

  console.log("ACCOUNTS TABLE COLUMNS:");
  console.log("=======================");
  if (columns.length === 0) {
    console.log("Table does not exist yet.");
  } else {
    columns.forEach(col => {
      console.log(`${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable ? 'NULL' : 'NOT NULL'}`);
    });
  }

  // Check for account_companies table
  console.log("\n\nACCOUNT_COMPANIES TABLE:");
  console.log("========================");
  const acTables = await sql`
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='account_companies') as exists;
  `;
  console.log(acTables[0].exists ? "EXISTS" : "DOES NOT EXIST");

  // Check record_translations table for accounts
  console.log("\n\nRECORD_TRANSLATIONS (accounts):");
  console.log("===============================");
  const translations = await sql`
    SELECT record_table, field_name, COUNT(*) as count
    FROM public.record_translations
    WHERE record_table = 'accounts'
    GROUP BY record_table, field_name;
  `;
  if (translations.length === 0) {
    console.log("No translation records for accounts yet.");
  } else {
    translations.forEach(t => {
      console.log(`${t.record_table} / ${t.field_name}: ${t.count} records`);
    });
  }

  process.exit(0);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
