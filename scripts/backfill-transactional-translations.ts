// Backfill record_translations for existing transactional narration/description rows that
// predate the write-path being wired up (roznamcha entries/lines, journal entries/lines,
// purchase/sales payment narration). Reuses the SAME decision logic as the live pipeline
// (lib/services/enterprise-multilingual-service.ts saveVerifiedEnterpriseRecordTranslations):
// a genuine local-dictionary hit or central approved system_dictionary term -> status
// "complete"; otherwise the unverified auto-translate guess -> status "needs_review". Never
// overwrites an existing record_translations row (only fills genuine gaps) and upserts via the
// same upsert_record_translation() RPC the live pipeline uses, so it cannot create duplicates.
//
// Usage:
//   npx tsx scripts/backfill-transactional-translations.ts                (dev, dry-run)
//   npx tsx scripts/backfill-transactional-translations.ts --write        (dev, writes)
//   npx tsx scripts/backfill-transactional-translations.ts --vps --write  (production, writes)
//   npx tsx scripts/backfill-transactional-translations.ts --table=roznamcha_entries --field=narration
//   npx tsx scripts/backfill-transactional-translations.ts --limit=100    (cap rows per table/field)

import fs from "node:fs";
import postgres from "postgres";

import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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

const isVps = has("--vps");
const isWrite = has("--write");
const onlyTable = opt("table");
const onlyField = opt("field");
const perTargetLimit = Number(opt("limit") || "0") || null;

const VPS_URL =
  resolveDbUrl("prod");

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const dbUrl = isVps ? VPS_URL : env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not configured (dev) — pass --vps for production, or set .env/.env.local");
  process.exit(1);
}
// lookupApprovedDictionary()/loadDictionary() (lib/i18n/localize-records.ts) read
// process.env.DATABASE_URL internally — set it so the central-dictionary tier targets the
// same database as this script's own connection (dev vs --vps).
process.env.DATABASE_URL = dbUrl;

const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 30 });

import { buildVerifiedTranslationSet } from "../lib/i18n/verified-record-translations";
import { lookupApprovedDictionary } from "../lib/i18n/localize-records";
import { autoTranslate5Languages, detectScriptType } from "../lib/i18n/multilingual-translator";
import type { SupportedLanguage } from "../lib/i18n/languages";

const LANG_KEYS: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];

// (table, field, mode) — mirrors lib/i18n/translatable-fields.ts entries for these tables.
const TARGETS: Array<[string, string, "translate"]> = [
  ["roznamcha_entries", "narration", "translate"],
  ["roznamcha_lines", "description", "translate"],
  ["journal_entries", "memo", "translate"],
  ["journal_lines", "description", "translate"],
  ["purchase_order_payments", "narration", "translate"],
  ["sales_order_payments", "remarks", "translate"]
].filter(([table, field]) => (!onlyTable || table === onlyTable) && (!onlyField || field === onlyField)) as Array<[string, string, "translate"]>;

function detectOriginalLanguage(text: string): SupportedLanguage {
  // Same convention the live write routes use: Arabic-script text -> "ur" (the script alone
  // cannot distinguish Ur/Ar/Fa/Ps), else "en".
  return detectScriptType(text) === "arabic" ? "ur" : "en";
}

async function resolveField(table: string, originalText: string, mode: "translate") {
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

async function backfillTarget(table: string, field: string, mode: "translate") {
  const gapRows = await sql.unsafe(
    `select b.id::text as id, b."${field}"::text as value
     from ${table} b
     where b."${field}" is not null and btrim(b."${field}"::text) <> ''
       and not exists (
         select 1 from record_translations rt
         where rt.record_table = $1 and rt.field_name = $2 and rt.record_id = b.id and rt.deleted_at is null
       )
     order by b.id
     ${perTargetLimit ? `limit ${perTargetLimit}` : ""}`,
    [table, field]
  );

  console.log(`\n=== ${table}.${field} — ${gapRows.length} row(s) missing a translation ===`);
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
  console.log(`Backfill target DB: ${isVps ? "VPS (production)" : "dev (DATABASE_URL)"} — mode: ${isWrite ? "WRITE" : "DRY-RUN"}`);
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
