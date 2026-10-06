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
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

async function inspectAllColumns() {
  const tables = [
    "accounts", "companies", "banks", "warehouses", "customers", "countries",
    "employees", "company_registration_types", "contact_types", "document_types",
    "account_types", "goods", "ports", "tax_codes", "product_units", "product_brands", "product_categories"
  ];

  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ${t} ORDER BY ordinal_position;
    `;
    console.log(`\nTable [${t}]:`);
    console.log(cols.map(c => `  ${c.column_name.padEnd(25)} (${c.data_type}) ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`).join("\n"));
  }

  process.exit(0);
}

inspectAllColumns();
