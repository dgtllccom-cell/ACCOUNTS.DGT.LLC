import postgres from "postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Dynamic Per-Language Master Data Resolver.
 * Resolves fields on records into the active language (`en`, `ur`, `ar`, `fa`, `ps`),
 * querying `record_translations` for all 5 languages.
 *
 * Rules (approved-translation-or-honest-fallback — NEVER machine-guess a spelling):
 * 1. Use the target-language value ONLY when it is a genuine approved translation:
 *    non-empty, different from the raw base value, AND different from the stored English
 *    (placeholder rows copy English into every language column, so those are NOT genuine).
 * 2. Otherwise fall back to the real stored value (english_text if present, else the raw
 *    value as-is). We do NOT transliterate/generate a spelling and present it as a
 *    translation — that produced wrong names. The audit (scripts/audit-*) flags records
 *    with placeholder/empty translations for human approval.
 */
export async function localizeRecordNames<T extends { id: string }>(
  records: T[],
  table: string,
  field: keyof T & string,
  lang: SupportedLanguage
): Promise<T[]> {
  if (!records || records.length === 0) return records;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return records;

  const ids = records.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return records;

  const targetCol =
    lang === "ur"
      ? "urdu_text"
      : lang === "ar"
      ? "arabic_text"
      : lang === "fa"
      ? "persian_text"
      : lang === "ps"
      ? "pashto_text"
      : "english_text";

  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 8 });
  try {
    const rows = await sql.unsafe(
      `select record_id, english_text, urdu_text, arabic_text, persian_text, pashto_text
       from record_translations
       where record_table = $1 and field_name = $2 and deleted_at is null
         and record_id = any($3::uuid[])`,
      [table, field, ids]
    ).catch(() => [] as Array<{
      record_id: string;
      english_text: string | null;
      urdu_text: string | null;
      arabic_text: string | null;
      persian_text: string | null;
      pashto_text: string | null;
    }>);

    const translationMap = new Map(rows.map((r) => [r.record_id, r]));

    return records.map((record) => {
      const rawValue = String(record[field] ?? "").trim();
      if (!rawValue) return record;

      const trans = translationMap.get(record.id);

      // APPROVED-TRANSLATION-OR-HONEST-FALLBACK (no machine-guessed spellings).
      // Per product rule: a name is only shown in the target language when an APPROVED
      // translation genuinely exists in record_translations. We NEVER generate/transliterate
      // a spelling and present it as if it were the translation — that produced wrong names
      // (e.g. bad Urdu spelling of a company). If no approved translation exists, fall back to
      // the real stored value (English/original) and let the audit flag the record for review.
      const targetVal = trans ? (trans[targetCol as keyof typeof trans] as string | null) : null;

      // A genuine, approved translation is: non-empty AND different from the raw base value
      // AND different from the stored English (placeholder rows copy English into every column).
      const englishVal = (trans?.english_text || "").trim();
      const isGenuine =
        !!targetVal &&
        targetVal.trim().length > 0 &&
        targetVal.trim() !== rawValue &&
        targetVal.trim() !== englishVal;

      if (isGenuine) {
        return { ...record, [field]: targetVal!.trim() };
      }

      // English view: prefer a stored english_text, else the raw value as-is.
      if (lang === "en") {
        if (englishVal) return { ...record, [field]: englishVal };
        return record;
      }

      // Non-English with no approved translation → honest fallback to the real stored value.
      // No transliteration, no "(UR)"/"[EN Pending]" guesses. Audit surfaces these for approval.
      return record;
    });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
