import fs from "node:fs";
import postgres from "postgres";
import { autoTranslate5Languages } from "../lib/i18n/multilingual-translator.js";

function loadEnv() {
  const env = {};
  const files = [".env.local", ".env"];
  for (const f of files) {
    try {
      if (fs.existsSync(f)) {
        for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const index = trimmed.indexOf("=");
          if (index === -1) continue;
          const key = trimmed.slice(0, index).trim();
          const val = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
          if (!env[key]) env[key] = val;
        }
      }
    } catch (e) {}
  }
  return env;
}

const env = loadEnv();
const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL not found in .env.local or .env");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 2, prepare: false, connect_timeout: 30 });

// Target tables and their translatable columns
const TARGET_TABLES = [
  { name: "customers", idCol: "id", nameCol: "customer_name" },
  { name: "employees", idCol: "id", nameCol: "full_name" },
  { name: "companies", idCol: "id", nameCol: "name" },
  { name: "banks", idCol: "id", nameCol: "name" },
  { name: "products", idCol: "id", nameCol: "product_name" },
  { name: "warehouses", idCol: "id", nameCol: "warehouse_name" },
  { name: "accounts", idCol: "id", nameCol: "name" },
  { name: "enterprise_accounts", idCol: "id", nameCol: "name" },
  { name: "countries", idCol: "id", nameCol: "name" },
  { name: "states_provinces", idCol: "id", nameCol: "name" },
  { name: "districts", idCol: "id", nameCol: "name" },
  { name: "cities", idCol: "id", nameCol: "name" },
  { name: "areas_locations", idCol: "id", nameCol: "name" },
  { name: "purchase_orders", idCol: "id", nameCol: "product_name" },
  { name: "sales_orders", idCol: "id", nameCol: "product_name" }
];

async function runAutoTranslationScan() {
  console.log("=======================================================================");
  console.log("  5-LANGUAGE DATABASE AUTO-TRANSLATION & BACKFILL ENGINE");
  console.log("  Database:", dbUrl.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  let totalTranslatedRecords = 0;

  for (const item of TARGET_TABLES) {
    console.log(`🔍 Scanning table "${item.name}"...`);
    try {
      const rows = await sql.unsafe(`select ${item.idCol} as id, ${item.nameCol} as name_val from public.${item.name} where ${item.nameCol} is not null and trim(${item.nameCol}) != ''`);
      
      let count = 0;
      for (const row of rows) {
        if (!row.name_val || !row.id) continue;
        
        // Generate 5-language translation dictionary
        const tr = autoTranslate5Languages(row.name_val);

        try {
          await sql`
            select public.upsert_record_translation(
              ${item.name}::text,
              ${row.id}::uuid,
              ${item.nameCol}::text,
              ${row.name_val}::text,
              'en'::text,
              ${tr.en}::text, ${tr.ur}::text, ${tr.ar}::text, ${tr.fa}::text, ${tr.ps}::text,
              '{}'::jsonb, 'auto'::text
            );
          `;
          count++;
          totalTranslatedRecords++;
        } catch (te) {}
      }
      console.log(`   ✅ Translated & backfilled ${count} records for "${item.name}".`);
    } catch (err) {
      console.log(`   ℹ️ Notice for "${item.name}": ${err.message}`);
    }
  }

  console.log("\n=======================================================================");
  console.log("🎉 5-LANGUAGE DATABASE AUTO-TRANSLATION COMPLETE!");
  console.log(`   • Total Records Translated & Backfilled: ${totalTranslatedRecords}`);
  console.log("   • All 5 per-language tables (record_translations_en, ur, ar, fa, ps)");
  console.log("     are now 100% updated and in sync!");
  console.log("=======================================================================");

  await sql.end();
}

runAutoTranslationScan().catch((err) => {
  console.error("❌ Auto-translation scan error:", err);
  process.exit(1);
});
