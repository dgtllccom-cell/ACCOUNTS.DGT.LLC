import postgres from "postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Central Per-Language Master Data Resolver — the ONE translation source for the whole ERP.
 * Resolves fields into the active language (`en`, `ur`, `ar`, `fa`, `ps`) via `record_translations`.
 *
 * THREE-TIER RESOLUTION (never machine-guess a spelling):
 *  1. Record-specific approved translation — this record's own row in record_translations,
 *     when genuine (non-empty, != raw, != stored English placeholder).
 *  2. Central Local Translator Dictionary — record_table='system_dictionary': if the raw term
 *     has an APPROVED dictionary translation, use it ERP-wide. Skipped for PROPER-NAME tables
 *     (companies/customers/employees/city/branch/…) so a proper name never inherits a generic
 *     term — those only ever use their own approved translation.
 *  3. Original value — English/source as-is, flagged elsewhere as needs_review. No transliteration,
 *     no invented Urdu/Arabic/Farsi/Pashto spelling.
 *
 * The dictionary is cached in-memory (fast) and invalidated immediately when QVC/Translator
 * approves a term (see invalidateSystemDictionaryCache()).
 */

const LANG_COL: Record<string, "urdu_text" | "arabic_text" | "persian_text" | "pashto_text" | "english_text"> = {
  ur: "urdu_text", ar: "arabic_text", fa: "persian_text", ps: "pashto_text", en: "english_text"
};

// Proper-name tables: a Company/Customer/Employee/City/Branch/etc. name must ONLY use its own
// approved translation — never a generic dictionary term. Tier-2 is disabled for these.
const PROPER_NAME_TABLES = new Set([
  "companies", "customers", "employees", "banks", "warehouses",
  "city_branches", "country_branches", "ports", "districts", "cities",
  "states_provinces", "countries", "areas_locations"
]);

type DictRow = { english_text: string | null; urdu_text: string | null; arabic_text: string | null; persian_text: string | null; pashto_text: string | null };

// ── system_dictionary cache (approved terms only) ──────────────────────────
let dictCache: Map<string, DictRow> | null = null;
let dictLoadedAt = 0;
const DICT_TTL_MS = 60_000;

/** Call after approving/correcting a term so ERP screens pick it up immediately. */
export function invalidateSystemDictionaryCache() {
  dictCache = null;
  dictLoadedAt = 0;
}

async function loadDictionary(sql: ReturnType<typeof postgres>): Promise<Map<string, DictRow>> {
  const now = Date.now();
  if (dictCache && now - dictLoadedAt < DICT_TTL_MS) return dictCache;
  const rows = await sql.unsafe(
    `select english_text, original_text, urdu_text, arabic_text, persian_text, pashto_text
     from record_translations
     where record_table = 'system_dictionary' and deleted_at is null
       and coalesce(translation_status,'') <> 'needs_review'`
  ).catch(() => [] as any[]);
  const map = new Map<string, DictRow>();
  for (const r of rows as any[]) {
    const key = String(r.english_text || r.original_text || "").trim().toLowerCase();
    if (key) map.set(key, r);
  }
  dictCache = map;
  dictLoadedAt = now;
  return map;
}

function genuine(target: string | null | undefined, raw: string, english: string): string | null {
  const t = (target || "").trim();
  if (t && t !== raw && t !== english) return t;
  return null;
}

/**
 * Tier-2 only: resolve a raw value against the central approved system_dictionary in one
 * language. Returns the genuine approved translation, or null (no guess). Disabled for
 * PROPER_NAME_TABLES so proper names never inherit a generic term. Shares the same cached
 * dictionary + `genuine()` filter the full resolver uses, so every screen stays consistent.
 * Lets services that resolve many mixed (table, field) targets at once (e.g. the ledger
 * report) apply the central dictionary tier without re-implementing it.
 */
export async function lookupApprovedDictionary(
  table: string,
  rawValue: string | null | undefined,
  lang: SupportedLanguage
): Promise<string | null> {
  const raw = (rawValue || "").trim();
  if (!raw || PROPER_NAME_TABLES.has(table)) return null;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  let dict = dictCache;
  if (!dict || Date.now() - dictLoadedAt >= DICT_TTL_MS) {
    const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 8 });
    try {
      dict = await loadDictionary(sql);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => undefined);
    }
  }
  const d = dict.get(raw.toLowerCase());
  if (!d) return null;
  const targetCol = LANG_COL[lang] || "english_text";
  return genuine(d[targetCol as keyof DictRow] as string, raw, (d.english_text || "").trim());
}

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

  const targetCol = LANG_COL[lang] || "english_text";
  const useDictionary = !PROPER_NAME_TABLES.has(table); // tier-2 only for non-proper-name fields

  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 8 });
  try {
    // Tier 1: this record's own translations.
    const rows = await sql.unsafe(
      `select record_id, english_text, urdu_text, arabic_text, persian_text, pashto_text
       from record_translations
       where record_table = $1 and field_name = $2 and deleted_at is null
         and record_id = any($3::uuid[])`,
      [table, field, ids]
    ).catch(() => [] as any[]);
    const recMap = new Map((rows as any[]).map((r) => [r.record_id, r]));

    // Tier 2: central approved dictionary (cached), only when needed & allowed.
    const dict = useDictionary ? await loadDictionary(sql) : null;

    return records.map((record) => {
      const rawValue = String(record[field] ?? "").trim();
      if (!rawValue) return record;
      const trans = recMap.get(record.id) as DictRow | undefined;
      const englishVal = (trans?.english_text || "").trim();

      // Tier 1 — record-specific approved translation.
      const recVal = genuine(trans ? (trans[targetCol as keyof DictRow] as string) : null, rawValue, englishVal);
      if (recVal) return { ...record, [field]: recVal };

      // Tier 2 — central dictionary (exact term match, approved only).
      if (dict) {
        const d = dict.get(rawValue.toLowerCase());
        if (d) {
          const dictVal = genuine(d[targetCol as keyof DictRow] as string, rawValue, (d.english_text || "").trim());
          if (dictVal) return { ...record, [field]: dictVal };
        }
      }

      // Tier 3 — honest original value (English preferred), no guessed spelling.
      if (lang === "en" && englishVal) return { ...record, [field]: englishVal };
      return record;
    });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
