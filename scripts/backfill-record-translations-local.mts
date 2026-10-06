/**
 * Backfill record_translations through the ERP Local Translator + Central Dictionary.
 *
 * Targets 'translate'-mode fields whose stored translations are still identity
 * copies of the English source (never translated, or clobbered by the old
 * enrollment trigger before migration 20261022). Each is re-run through
 * translateMasterRecord() → saveVerifiedEnterpriseRecordTranslations, whose
 * primary tier is our own translateErp() with allowExternal:false — glossary /
 * translation-memory / local phrase engine only, NEVER Google. Whatever the
 * local engine cannot render stays flagged needs_review (unchanged, for a human).
 *
 * Safe, resumable, read-mostly. Touches only record_translations.
 *
 *   node_modules/.bin/vite-node --config vitest.config.mjs \
 *     scripts/backfill-record-translations-local.mts -- --limit=500 [--table=roznamcha_lines] [--dry]
 */
import fs from "node:fs";
import postgres from "postgres";
import { translateMasterRecord } from "../lib/services/translation-trigger-service";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
) as Record<string, string | boolean>;
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const ONLY_TABLE = typeof args.table === "string" ? args.table : null;
const DRY = !!args.dry;

const url = (fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m) || [])[1]
  .trim()
  .replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });

async function main() {
  const rows = (await sql`
    select rt.record_table, rt.record_id, rt.field_name, rt.original_text,
           coalesce(rt.original_language_code,'en') as lang
    from record_translations rt
    join translation_field_registry fr
      on fr.table_name = rt.record_table and fr.field_name = rt.field_name and fr.mode = 'translate'
    where fr.is_active
      and coalesce(rt.urdu_text,'')    = coalesce(rt.english_text,'')
      and coalesce(rt.arabic_text,'')  = coalesce(rt.english_text,'')
      and coalesce(rt.persian_text,'') = coalesce(rt.english_text,'')
      and coalesce(rt.pashto_text,'')  = coalesce(rt.english_text,'')
      and coalesce(rt.original_text,'') <> ''
      ${ONLY_TABLE ? sql`and rt.record_table = ${ONLY_TABLE}` : sql``}
    order by rt.record_table, rt.record_id
  `) as unknown as Array<{ record_table: string; record_id: string; field_name: string; original_text: string; lang: string }>;

  const targets = Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;
  console.log(`candidates: ${rows.length} → processing ${targets.length}${ONLY_TABLE ? ` (table=${ONLY_TABLE})` : ""}${DRY ? " [DRY RUN]" : ""}`);
  let done = 0, failed = 0;

  for (const row of targets) {
    done++;
    try {
      if (DRY) { console.log(`  would translate ${row.record_table}.${row.field_name} "${String(row.original_text).slice(0, 60)}"`); continue; }
      await translateMasterRecord(row.record_table, row.record_id, { [row.field_name]: row.original_text }, row.lang as never, null);
    } catch (e) {
      failed++;
      if (failed <= 10) console.warn(`  ! ${row.record_table}.${row.field_name}: ${(e as Error)?.message || e}`);
    }
    if (done % 200 === 0) console.log(`  …${done}/${targets.length} (failed ${failed})`);
  }

  if (!DRY) {
    const after = (await sql`
      select translation_status, count(*)::int n from record_translations
      where updated_at > now() - interval '30 minutes'
        and translated_by_engine in ('local_translator','local_dictionary','auto_unverified')
      group by 1`) as unknown as Array<{ translation_status: string; n: number }>;
    console.log("outcome by status (last 30m):", after);
  }
  console.log(`\ndone: processed ${done}  failed ${failed}`);
  await sql.end();
}

main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
