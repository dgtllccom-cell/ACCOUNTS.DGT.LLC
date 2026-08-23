// Backfill record_translations for master tables whose CREATE path never wired
// translateMasterRecord/translateMasterRecordsBatch (confirmed via a fresh DB audit:
// ledgers, warehouses [prod only — dev is already 100%], product_categories,
// product_brands, product_units, shipping_line_records). Reuses the SAME no-guess
// decision logic as the transactional backfill (scripts/backfill-transactional-translations.ts)
// and the live save-time pipeline (lib/services/enterprise-multilingual-service.ts):
// a genuine local-dictionary hit or central approved system_dictionary term -> status
// "complete"; otherwise the unverified auto-translate/transliteration guess -> status
// "needs_review". Never overwrites an existing record_translations row (only fills genuine
// gaps) and upserts via the same upsert_record_translation() RPC the live pipeline uses.
//
// Unlike the existing scripts/backfill-transactional-translations.ts, this file does NOT
// hardcode a production connection string — DATABASE_URL must come from the environment
// (dev: .env/.env.local; prod: run this file on the VPS where DATABASE_URL is already set).
//
// Usage:
//   npx tsx scripts/backfill-master-translations.ts                (dry-run)
//   npx tsx scripts/backfill-master-translations.ts --write        (writes)
//   npx tsx scripts/backfill-master-translations.ts --table=ledgers --field=name
//   npx tsx scripts/backfill-master-translations.ts --limit=100    (cap rows per table/field)

import fs from "node:fs";
import postgres from "postgres";

function loadEnvFile(f: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(f)) return env;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i > -1) env[trimmed.slice(0, i)] = trimmed.slice(i + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const opt = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const isWrite = has("--write");
const onlyTable = opt("table");
const onlyField = opt("field");
const perTargetLimit = Number(opt("limit") || "0") || null;

const fileEnv = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const dbUrl = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not configured — set it in the environment or .env/.env.local (never hardcode a connection string in this file).");
  process.exit(1);
}
process.env.DATABASE_URL = dbUrl;

const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 30 });

import { buildVerifiedTranslationSet } from "../lib/i18n/verified-record-translations";
import { lookupApprovedDictionary } from "../lib/i18n/localize-records";
import { autoTranslate5Languages, detectScriptType } from "../lib/i18n/multilingual-translator";
import type { SupportedLanguage } from "../lib/i18n/languages";

const LANG_KEYS: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];

type Mode = "translate" | "transliterate";
const TARGETS: Array<[string, string, Mode]> = ([
  ["ledgers", "name", "transliterate"],
  ["warehouses", "warehouse_name", "transliterate"],
  ["product_categories", "category_name", "translate"],
  ["product_brands", "brand_name", "translate"],
  ["product_units", "unit_name", "translate"],
  ["shipping_line_records", "shipping_line_name", "transliterate"],
  // country_branches/city_branches CREATE+UPDATE never called the translation sync at all
  // (confirmed via code audit — translateMasterRecord was invoked with a hardcoded "en" source
  // and only { name, owner_name } / { name, city_name, owner_name }, silently excluding
  // "address"). Fixed going forward in app/api/branch-management/{city,country}-branches/route.ts;
  // these targets backfill every existing row across all four now-registered fields.
  ["country_branches", "name", "transliterate"],
  ["country_branches", "owner_name", "transliterate"],
  ["country_branches", "address", "translate"],
  ["city_branches", "name", "transliterate"],
  ["city_branches", "city_name", "transliterate"],
  ["city_branches", "owner_name", "transliterate"],
  ["city_branches", "address", "translate"]
] as Array<[string, string, Mode]>).filter(
  ([table, field]) => (!onlyTable || table === onlyTable) && (!onlyField || field === onlyField)
);

function detectOriginalLanguage(text: string): SupportedLanguage {
  return detectScriptType(text) === "arabic" ? "ur" : "en";
}

async function resolveField(table: string, originalText: string, mode: Mode) {
  const originalLanguage = detectOriginalLanguage(originalText);
  const verified = await buildVerifiedTranslationSet({ value: originalText, originalLanguage, mode });

  for (const lng of LANG_KEYS) {
    if (verified.translations[lng]?.trim()) continue;
    const dictVal = await lookupApprovedDictionary(table, originalText, lng);
    if (dictVal) verified.translations[lng] = dictVal;
  }

  let usedUnverifiedFallback = false;
  const auto5 = autoTranslate5Languages(originalText, originalLanguage);
  for (const lng of LANG_KEYS) {
    if (!verified.translations[lng]?.trim()) {
      verified.translations[lng] = auto5[lng] || originalText;
      usedUnverifiedFallback = true;
    }
  }

  const status = usedUnverifiedFallback ? "needs_review" : "complete";
  const engine = usedUnverifiedFallback ? "auto_unverified" : "local_dictionary";
  return { originalLanguage, translations: verified.translations, status, engine };
}

async function backfillTarget(table: string, field: string, mode: Mode) {
  const gapRows = await sql.unsafe(
    `select b.id::text as id, b."${field}"::text as value
     from ${table} b
     where b."${field}" is not null and btrim(b."${field}"::text) <> ''
       and (b.deleted_at is null or not exists (select 1 from information_schema.columns where table_name = '${table}' and column_name = 'deleted_at'))
       and not exists (
         select 1 from record_translations rt
         where rt.record_table = $1 and rt.field_name = $2 and rt.record_id = b.id and rt.deleted_at is null
       )
     order by b.id
     ${perTargetLimit ? `limit ${perTargetLimit}` : ""}`,
    [table, field]
  );

  console.log(`\n=== ${table}.${field} (${mode}) — ${gapRows.length} row(s) missing a translation ===`);
  if (gapRows.length === 0) return { table, field, processed: 0, complete: 0, needsReview: 0 };

  let complete = 0;
  let needsReview = 0;
  let sampleCount = 0;
  for (const row of gapRows as Array<{ id: string; value: string }>) {
    const originalText = String(row.value).trim();
    const resolved = await resolveField(table, originalText, mode);
    if (resolved.status === "complete") complete++; else needsReview++;

    if (isWrite) {
      await sql`select public.upsert_record_translation(
        ${table}, ${row.id}::uuid, ${field}, ${originalText}, ${resolved.originalLanguage},
        ${resolved.translations.en ?? null}, ${resolved.translations.ur ?? null}, ${resolved.translations.ar ?? null},
        ${resolved.translations.fa ?? null}, ${resolved.translations.ps ?? null},
        ${sql.json(resolved.translations as any)}, 'imported', ${resolved.status}, ${resolved.engine}, null::uuid)`;
    } else if (sampleCount < 3) {
      sampleCount++;
      console.log(`  [dry-run] ${row.id} lang=${resolved.originalLanguage} status=${resolved.status}\n    en="${resolved.translations.en}"\n    ur="${resolved.translations.ur}"`);
    }
  }

  console.log(`  ${isWrite ? "Wrote" : "Would write"} ${gapRows.length} rows — complete=${complete}, needs_review=${needsReview}`);
  return { table, field, processed: gapRows.length, complete, needsReview };
}

async function main() {
  console.log(`Backfill target DB: ${dbUrl.includes("inmayhrx") ? "PRODUCTION" : "dev/other"} — mode: ${isWrite ? "WRITE" : "DRY-RUN"}`);
  const results = [];
  for (const [table, field, mode] of TARGETS) {
    results.push(await backfillTarget(table, field, mode));
  }
  const totals = results.reduce(
    (acc, r) => ({ processed: acc.processed + r.processed, complete: acc.complete + r.complete, needsReview: acc.needsReview + r.needsReview }),
    { processed: 0, complete: 0, needsReview: 0 }
  );
  console.log(`\n=== TOTAL: processed=${totals.processed} complete=${totals.complete} needs_review=${totals.needsReview} ===`);
  if (!isWrite) console.log("(dry-run — re-run with --write to actually save these translations)");
  await sql.end({ timeout: 2 }).catch(() => undefined);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
