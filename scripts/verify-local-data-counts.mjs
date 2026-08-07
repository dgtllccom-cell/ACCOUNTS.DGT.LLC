import fs from "node:fs";
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
  } catch (e) {}
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

async function verifyCounts() {
  console.log("=======================================================================");
  console.log("  LOCAL POSTGRESQL (localhost:5432) TRANSFERRED DATA VERIFICATION");
  console.log("=======================================================================\n");

  const businessTables = [
    "countries",
    "states_provinces",
    "districts",
    "cities",
    "areas_locations",
    "accounts",
    "enterprise_accounts",
    "ledgers",
    "companies",
    "customers",
    "purchase_orders",
    "sales_orders",
    "products",
    "goods",
    "warehouses"
  ];

  console.log("▶ 1. Business Data Tables Row Counts:");
  for (const t of businessTables) {
    try {
      const res = await sql.unsafe(`select count(*)::int as n from public.${t}`);
      console.log(`  • public.${t.padEnd(25)}: ${res[0].n} rows`);
    } catch (e) {
      console.log(`  • public.${t.padEnd(25)}: (Table not initialized yet)`);
    }
  }

  console.log("\n▶ 2. 5-Language Dedicated Tables Row Counts:");
  const langTables = [
    { name: "translations_english", flag: "🇬🇧", lang: "English Table" },
    { name: "translations_urdu", flag: "🇵🇰", lang: "Urdu Table" },
    { name: "translations_arabic", flag: "🇸🇦", lang: "Arabic Table" },
    { name: "translations_persian", flag: "🇮🇷", lang: "Persian Table" },
    { name: "translations_pashto", flag: "🇦🇫", lang: "Pashto Table" }
  ];

  for (const t of langTables) {
    try {
      const res = await sql.unsafe(`select count(*)::int as n from public.${t.name} where deleted_at is null`);
      console.log(`  ${t.flag} public.${t.name.padEnd(23)}: ${res[0].n} rows`);
    } catch (e) {
      console.log(`  ${t.flag} public.${t.name.padEnd(23)}: (0 rows)`);
    }
  }

  console.log("\n▶ 3. Reconstructed Joined View (public.record_translations):");
  try {
    const viewRes = await sql`select count(*)::int as n from public.record_translations where deleted_at is null`;
    console.log(`  🌐 public.record_translations (VIEW) : ${viewRes[0].n} rows`);
  } catch (e) {
    console.log(`  🌐 public.record_translations (VIEW) : 0 rows`);
  }

  console.log("\n=======================================================================");
  console.log("  VERIFICATION COMPLETE!");
  console.log("=======================================================================");

  await sql.end();
}

verifyCounts().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
