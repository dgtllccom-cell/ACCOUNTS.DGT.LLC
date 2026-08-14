import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}
const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const LOCAL = env.DATABASE_URL; // csesvyxx (dev/old-prod)
const VPS = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

// Dependency-ordered set of business/master tables to migrate.
const TABLES = [
  "countries", "states_provinces", "cities", "districts", "areas_locations", "postal_codes",
  "country_branches", "city_branches",
  "companies", "customers", "customer_contacts",
  "banks", "warehouses", "employees",
  "goods", "product_categories", "product_brands", "product_units",
  "account_groups", "account_types", "accounts",
  "account_companies", "account_banks", "account_warehouses", "account_customer_owners",
  "contact_types", "document_types", "company_registration_types", "ports",
  "product_inventory_balances",
  "record_translations"
];

const local = postgres(LOCAL, { max: 1, prepare: false, connect_timeout: 30 });
const vps = postgres(VPS, { max: 1, prepare: false, connect_timeout: 30 });

async function counts(db, label) {
  const out = {};
  for (const t of TABLES) {
    try {
      const r = await db.unsafe(`select count(*)::int as c from public."${t}"`);
      out[t] = r[0].c;
    } catch (e) {
      out[t] = `MISSING (${String(e.message).slice(0, 40)})`;
    }
  }
  return out;
}

try {
  console.log("Collecting counts (this reads only, no writes)...\n");
  const [l, v] = await Promise.all([counts(local, "LOCAL"), counts(vps, "VPS")]);
  console.log("TABLE".padEnd(32), "LOCAL".padStart(10), "VPS".padStart(10));
  console.log("-".repeat(54));
  let totL = 0, totV = 0;
  for (const t of TABLES) {
    const lc = l[t], vc = v[t];
    if (typeof lc === "number") totL += lc;
    if (typeof vc === "number") totV += vc;
    console.log(t.padEnd(32), String(lc).padStart(10), String(vc).padStart(10));
  }
  console.log("-".repeat(54));
  console.log("TOTAL".padEnd(32), String(totL).padStart(10), String(totV).padStart(10));
  process.exit(0);
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
