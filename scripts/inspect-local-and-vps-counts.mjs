import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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

const localEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

const tables = [
  "countries", "states_provinces", "districts", "cities", "areas_locations",
  "country_branches", "city_branches", "companies", "customers", "banks",
  "warehouses", "goods", "products", "employees", "company_registration_types",
  "contact_types", "document_types", "account_types", "ports", "tax_codes",
  "product_units", "product_brands", "product_categories", "accounts",
  "account_companies", "account_banks", "account_warehouses", "account_customer_owners",
  "stock_movements", "product_inventory_balances",
  "translations_english", "translations_urdu", "translations_arabic", "translations_persian", "translations_pashto",
  "record_translations"
];

async function inspectCounts() {
  console.log("=================================================================================");
  console.log("                 LOCAL vs VPS DATABASE RECORD COUNTS (BEFORE MIGRATION)          ");
  console.log("=================================================================================\n");

  const results = [];

  for (const table of tables) {
    let localCount = 0;
    let vpsCount = 0;

    try {
      const resL = await localSql.unsafe(`SELECT COUNT(*)::int as count FROM public."${table}"`);
      localCount = resL[0].count;
    } catch (e) {
      localCount = "N/A";
    }

    try {
      const resV = await vpsSql.unsafe(`SELECT COUNT(*)::int as count FROM public."${table}"`);
      vpsCount = resV[0].count;
    } catch (e) {
      vpsCount = "N/A";
    }

    results.push({
      "Table": table,
      "LOCAL Count": localCount,
      "VPS Count (Before)": vpsCount
    });
  }

  console.table(results);
  await localSql.end();
  await vpsSql.end();
  process.exit(0);
}

inspectCounts().catch(err => {
  console.error("Error inspecting counts:", err);
  process.exit(1);
});
