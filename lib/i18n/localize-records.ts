import postgres from "postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Bulk-resolve a translatable field on a list of records into the active language,
 * reading from `record_translations` (the same store every create/update path already
 * writes to via translateMasterRecord / syncRecordTranslations).
 *
 * One query for the whole list (not one RPC per row) — this is meant to sit behind
 * dropdown/report endpoints, where N can be in the hundreds.
 *
 * English is never rewritten (the DB column already IS the English value); for any
 * other active language, a resolved translation overrides the field, and a record with
 * no stored translation yet simply keeps its original (English) value — never blank.
 */
export async function localizeRecordNames<T extends { id: string }>(
  records: T[],
  table: string,
  field: keyof T & string,
  lang: SupportedLanguage
): Promise<T[]> {
  if (lang === "en" || records.length === 0) return records;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return records;

  const ids = records.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return records;

  const column = lang === "ur" ? "urdu_text" : lang === "ar" ? "arabic_text" : lang === "fa" ? "persian_text" : lang === "ps" ? "pashto_text" : "english_text";

  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 8 });
  try {
    const rows = await sql.unsafe(
      `select record_id, "${column}" as text
       from record_translations
       where record_table = $1 and field_name = $2 and deleted_at is null
         and record_id = any($3::uuid[]) and "${column}" is not null and trim("${column}") <> ''`,
      [table, field, ids]
    ).catch(() => [] as Array<{ record_id: string; text: string }>);

    if (rows.length === 0) return records;
    const byId = new Map(rows.map((r) => [r.record_id, r.text]));
    return records.map((record) => {
      const translated = byId.get(record.id);
      return translated ? { ...record, [field]: translated } : record;
    });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
