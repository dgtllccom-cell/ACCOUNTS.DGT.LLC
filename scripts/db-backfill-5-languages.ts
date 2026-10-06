import fs from "node:fs";
import postgres from "postgres";
import { TRANSLATABLE_FIELDS } from "../lib/i18n/translatable-fields";
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

const sql = postgres(dbUrl, { max: 2, prepare: false, connect_timeout: 30 });

async function backfill() {
  console.log("==========================================================================");
  console.log("  EXECUTING 5-LANGUAGE DATABASE MASTER TRANSLATIONS BACKFILL & SYNC         ");
  console.log("==========================================================================\n");

  let totalBackfilled = 0;

  for (const [table, fields] of Object.entries(TRANSLATABLE_FIELDS)) {
    try {
      // Check if table exists in public schema
      const [tableExists] = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = ${table}
        ) as exists
      `;
      if (!tableExists?.exists) continue;

      for (const { field, mode } of fields) {
        // Check if column exists in table
        const [colExists] = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${field}
          ) as exists
        `;
        if (!colExists?.exists) continue;

        // Fetch rows where field is not null/empty
        const rows = await sql.unsafe(`
          SELECT id, "${field}" as original_val 
          FROM public."${table}" 
          WHERE "${field}" IS NOT NULL AND btrim("${field}"::text) <> ''
        `);

        let countForField = 0;
        for (const r of rows) {
          if (!r.id || !r.original_val) continue;
          const original = String(r.original_val).trim();
          if (!original) continue;

          // Check if genuine translation already exists
          const [existing] = await sql`
            SELECT id, urdu_text, arabic_text, persian_text, pashto_text, english_text
            FROM public.record_translations
            WHERE record_table = ${table} AND record_id = ${r.id}::uuid AND field_name = ${field} AND deleted_at IS NULL
          `;

          const hasGenuine = existing &&
            existing.urdu_text && existing.urdu_text !== existing.english_text &&
            existing.arabic_text && existing.arabic_text !== existing.english_text;

          if (hasGenuine) continue;

          // Generate genuine 5-language translation / transliteration
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
          countForField++;
          totalBackfilled++;
        }

        if (countForField > 0) {
          console.log(`✓ Backfilled ${countForField} translations for table "${table}" (field: "${field}")`);
        }
      }
    } catch (err: any) {
      console.warn(`Notice for table ${table}: ${err.message}`);
    }
  }

  console.log("\n==========================================================================");
  console.log(`TOTAL BACKFILLED / UPDATED TRANSLATIONS: ${totalBackfilled}`);
  console.log("==========================================================================\n");

  await sql.end();
}

backfill().catch(console.error);
