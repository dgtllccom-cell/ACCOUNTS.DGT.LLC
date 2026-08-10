import postgres from "postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { transliterateProperNoun } from "@/lib/i18n/transliteration";

const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFE]/;

function isArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_REGEX.test(text || "");
}

/**
 * Dynamic Per-Language Master Data Resolver.
 * Resolves fields on records into the active language (`en`, `ur`, `ar`, `fa`, `ps`),
 * querying `record_translations` for all 5 languages.
 *
 * Rules:
 * 1. If active language has a stored, non-empty translation -> use it.
 * 2. If active language is EN, but raw base text is in Urdu/Arabic script and no EN translation exists ->
 *    return transliterated Latin or formatted indicator so Urdu is NOT displayed as English.
 * 3. If active language is UR/AR/FA/PS, but raw base text is in English script and no target translation exists ->
 *    return transliterated Perso-Arabic so English is NOT displayed as Urdu/Arabic.
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

      // Check if target language column in record_translations has a non-empty value
      const targetVal = trans ? (trans[targetCol as keyof typeof trans] as string | null) : null;
      if (targetVal && targetVal.trim() && targetVal.trim() !== rawValue) {
        return { ...record, [field]: targetVal.trim() };
      }

      // If active language is English (en)
      if (lang === "en") {
        if (trans?.english_text && trans.english_text.trim()) {
          return { ...record, [field]: trans.english_text.trim() };
        }
        // If raw base text is in Urdu/Arabic script (e.g. "محمد علي"), do not present Urdu as English!
        if (isArabicScript(rawValue)) {
          const latinApprox = transliterateProperNoun(rawValue, "en");
          return {
            ...record,
            [field]: latinApprox && latinApprox !== rawValue ? latinApprox : `${rawValue} [EN Pending]`
          };
        }
        return record;
      }

      // For Non-English active languages (ur, ar, fa, ps)
      const isRawArabicScript = isArabicScript(rawValue);

      // If raw text is English (e.g. "Digital Dock LLC"), transliterate or format pending indicator
      if (!isRawArabicScript) {
        const scriptApprox = transliterateProperNoun(rawValue, lang);
        return {
          ...record,
          [field]: scriptApprox && scriptApprox !== rawValue ? scriptApprox : `${rawValue} (${lang.toUpperCase()})`
        };
      }

      return record;
    });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
