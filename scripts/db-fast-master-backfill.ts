import fs from "node:fs";
import postgres from "postgres";
import { autoTranslate5Languages } from "../lib/i18n/multilingual-translator";

function loadEnv() {
  const env: Record<string, string> = {};
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
  console.error("DATABASE_URL not configured");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 10, prepare: false, connect_timeout: 30 });

// Core ERP Master Entities and their translatable fields
const CORE_MASTER_FIELDS: Record<string, string[]> = {
  banks: ["name", "bank_name", "branch_name"],
  warehouses: ["name", "warehouse_name", "location_name"],
  employees: ["full_name", "name", "designation", "department"],
  goods: ["goods_name", "name", "product_name", "description", "category"],
  ports: ["name", "port_name"],
  clearing_agents: ["name", "agent_name", "company_name"],
  countries: ["name"],
  city_branches: ["name"],
  country_branches: ["name", "branding_company_name", "branding_address"],
  companies: ["name", "legal_name", "owner_name"],
  customers: ["name", "customer_name", "company_name", "contact_person"],
  accounts: ["name", "account_name"],
  shipping_lines: ["name", "company_name"],
  company_registration_types: ["name"],
  document_types: ["name"]
};

async function fastBackfill() {
  console.log("==========================================================================");
  console.log("   FAST BATCH 5-LANGUAGE DATABASE MASTER TRANSLATIONS BACKFILL & SYNC     ");
  console.log("==========================================================================\n");

  let totalUpserted = 0;

  for (const [table, fields] of Object.entries(CORE_MASTER_FIELDS)) {
    try {
      const [tableExists] = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = ${table}
        ) as exists
      `;
      if (!tableExists?.exists) continue;

      for (const field of fields) {
        const [colExists] = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${field}
          ) as exists
        `;
        if (!colExists?.exists) continue;

        const rows = await sql.unsafe(`
          SELECT id, "${field}" as original_val 
          FROM public."${table}" 
          WHERE "${field}" IS NOT NULL AND btrim("${field}"::text) <> ''
        `);

        if (!rows || rows.length === 0) continue;

        // Fetch existing translations for this table and field
        const existingTranslations = await sql`
          SELECT record_id, urdu_text, arabic_text, persian_text, pashto_text, english_text
          FROM public.record_translations
          WHERE record_table = ${table} AND field_name = ${field} AND deleted_at IS NULL
        `;

        const existingMap = new Map();
        for (const et of existingTranslations) {
          const isGenuine = et.urdu_text && et.urdu_text !== et.english_text &&
                            et.arabic_text && et.arabic_text !== et.english_text;
          if (isGenuine) {
            existingMap.set(et.record_id, true);
          }
        }

        const pendingRows = rows.filter((r: any) => r.id && r.original_val && !existingMap.has(r.id));
        if (pendingRows.length === 0) continue;

        console.log(`Processing ${pendingRows.length} records for ${table}.${field}...`);

        // Batch in groups of 20
        const CHUNK_SIZE = 20;
        for (let i = 0; i < pendingRows.length; i += CHUNK_SIZE) {
          const chunk = pendingRows.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (r: any) => {
              const original = String(r.original_val).trim();
              const trans = autoTranslate5Languages(original, "en");

              await sql`
                SELECT public.upsert_record_translation(
                  ${table}::text,
                  ${r.id}::uuid,
                  ${field}::text,
                  ${original}::text,
                  'en'::text,
                  ${trans.en || original}::text,
                  ${trans.ur || original}::text,
                  ${trans.ar || original}::text,
                  ${trans.fa || original}::text,
                  ${trans.ps || original}::text,
                  ${sql.json({ en: trans.en, ur: trans.ur, ar: trans.ar, fa: trans.fa, ps: trans.ps })}::jsonb,
                  'auto'::text,
                  'complete'::text,
                  'local_multilingual'::text,
                  null::uuid
                );
              `;
              totalUpserted++;
            })
          );
        }
        console.log(`✓ Completed ${pendingRows.length} translations for ${table}.${field}`);
      }
    } catch (err: any) {
      console.warn(`Error on table ${table}:`, err.message);
    }
  }

  console.log("\n==========================================================================");
  console.log(`TOTAL MASTER TRANSLATIONS BACKFILLED: ${totalUpserted}`);
  console.log("==========================================================================\n");

  await sql.end();
}

fastBackfill().catch(console.error);
