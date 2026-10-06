/**
 * Backfill display transliterations for proper-name master data.
 *
 * WHY: master records entered in Perso-Arabic script (customer / company / bank /
 * person / goods names) only had their ORIGINAL text stored — or a poor early
 * machine guess ("Hamd Shryf" for "حامد شریف"). An English viewer then saw the
 * Arabic script (or the poor guess), and search by the English spelling missed
 * the record. This fills `record_translations.english_text` with the improved
 * offline transliteration so DISPLAY and SEARCH agree, and mirrors the original
 * into the other Perso-Arabic columns (they are mutually legible).
 *
 * SAFE: never touches the source column on the master table. Only writes
 * `record_translations`. Rows are flagged `needs_review` (still machine, not
 * human-approved). Idempotent — re-running only improves.
 *
 *   node scripts/backfill-proper-name-transliterations.mjs            # DEV (.env.local)
 *   DATABASE_URL=<prod-url> node scripts/backfill-proper-name-transliterations.mjs --apply
 */
import fs from "node:fs";
import postgres from "postgres";
import { transliterateToLatin } from "../lib/i18n/transliteration.ts";
import { TRANSLATABLE_FIELDS } from "../lib/i18n/translatable-fields.ts";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i);
      if (!process.env[k]) process.env[k] = t.slice(i + 1).replace(/^"|"$/g, "");
    }
  }
}
loadEnv();

const APPLY = process.argv.includes("--apply") || process.argv.includes("-y");
const URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!URL) { console.error("No DATABASE_URL"); process.exit(1); }

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-z]/;
const TRUSTED_ENGINES = new Set(["manual", "local_dictionary", "dictionary", "glossary", "human", "verified"]);

// proper-name (transliterate-mode) fields for the master tables that matter
const TARGETS = [];
for (const [table, defs] of Object.entries(TRANSLATABLE_FIELDS)) {
  for (const d of defs) if (d.mode === "transliterate") TARGETS.push([table, d.field]);
}

const sql = postgres(URL, { max: 3 });

let scanned = 0, updated = 0, inserted = 0, skipped = 0;

for (const [table, field] of TARGETS) {
  // record_translations rows for this (table, field) whose source is Perso-Arabic
  // and whose english_text is missing / a copy of the source / an untrusted guess.
  let rows;
  try {
    rows = await sql`
      select id, record_id, original_text, original_language_code,
             english_text, urdu_text, arabic_text, persian_text, pashto_text,
             translation_status, translated_by_engine
      from public.record_translations
      where record_table = ${table} and field_name = ${field} and deleted_at is null
        and original_text ~ '[؀-ۿ]'
    `;
  } catch (e) {
    console.warn(`skip ${table}.${field}: ${e.message}`);
    continue;
  }

  for (const r of rows) {
    scanned++;
    const src = (r.original_text || "").trim();
    if (!src || !ARABIC.test(src)) { skipped++; continue; }

    const enTrusted =
      r.english_text && r.english_text.trim() && r.english_text.trim() !== src &&
      LATIN.test(r.english_text) && !ARABIC.test(r.english_text) &&
      (["human_verified", "verified"].includes((r.translation_status || "").toLowerCase()) ||
        TRUSTED_ENGINES.has((r.translated_by_engine || "").toLowerCase()));
    if (enTrusted) { skipped++; continue; }

    const latin = transliterateToLatin(src).trim();
    if (!latin || ARABIC.test(latin) || !LATIN.test(latin) || latin.toLowerCase() === src.toLowerCase()) {
      skipped++; continue;
    }

    // mirror the original into any empty Perso-Arabic column (mutually legible)
    const ur = (r.urdu_text || "").trim() || src;
    const ar = (r.arabic_text || "").trim() || src;
    const fa = (r.persian_text || "").trim() || src;
    const ps = (r.pashto_text || "").trim() || src;

    if (!APPLY) {
      if (updated < 12) console.log(`  ${table}.${field}  ${JSON.stringify(src)} -> en ${JSON.stringify(latin)}`);
      updated++;
      continue;
    }
    await sql`
      update public.record_translations
      set english_text = ${latin}, urdu_text = ${ur}, arabic_text = ${ar}, persian_text = ${fa}, pashto_text = ${ps},
          language_texts = ${sql.json({ en: latin, ur, ar, fa, ps })},
          translation_status = 'needs_review',
          translated_by_engine = 'local_transliteration',
          updated_at = now()
      where id = ${r.id}
    `;
    updated++;
  }
}

console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"}: scanned ${scanned}, updated ${updated}, inserted ${inserted}, skipped ${skipped}`);
if (!APPLY) console.log("Re-run with --apply to write.");
await sql.end();
