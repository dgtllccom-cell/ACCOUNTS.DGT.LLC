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

async function auditMasterTables() {
  console.log("=== AUDITING ALL MASTER DATA DB TABLES ===");

  const masterTables = [
    "accounts",
    "companies",
    "banks",
    "warehouses",
    "customers",
    "locations",
    "employees",
    "company_registration_types",
    "contact_types",
    "document_types",
    "account_types",
    "goods",
    "goods_variations",
    "ports",
    "tax_codes",
    "product_units",
    "product_brands",
    "product_categories",
    "account_companies",
    "account_banks",
    "account_warehouses",
    "account_customer_owners"
  ];

  for (const table of masterTables) {
    try {
      const existsRes = await sql`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${table}) as exists;
      `;
      const exists = existsRes[0].exists;
      if (!exists) {
        console.log(`[MISSING TABLE] ${table}`);
      } else {
        const countRes = await sql.unsafe(`SELECT COUNT(*) as count FROM public."${table}" WHERE deleted_at IS NULL`);
        console.log(`[OK] ${table.padEnd(28)} -> ${countRes[0].count} records`);
      }
    } catch (e) {
      console.log(`[ERROR checking ${table}]:`, e.message);
    }
  }

  process.exit(0);
}

auditMasterTables();
