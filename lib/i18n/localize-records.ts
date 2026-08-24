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

// Phrase-substitution index: dictionary terms compiled to whole-word regexes, sorted
// longest-first so multi-word terms ("General Traders", "Almond Kernel") match before their
// parts. Rebuilt whenever the dictionary cache changes.
type PhraseTerm = { re: RegExp; row: DictRow };
let phraseTermsCache: PhraseTerm[] | null = null;
let phraseTermsBuiltAt = 0;

/** Call after approving/correcting a term so ERP screens pick it up immediately. */
export function invalidateSystemDictionaryCache() {
  dictCache = null;
  dictLoadedAt = 0;
  phraseTermsCache = null;
  phraseTermsBuiltAt = 0;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build (and cache) the longest-first whole-word regex list from the dictionary. */
function getPhraseTerms(dict: Map<string, DictRow>): PhraseTerm[] {
  if (phraseTermsCache && phraseTermsBuiltAt === dictLoadedAt) return phraseTermsCache;
  const terms: Array<{ term: string; row: DictRow }> = [];
  for (const [key, row] of dict) {
    const term = (row.english_text || "").trim() || key;
    if (term && /[a-z]/i.test(term)) terms.push({ term, row }); // only English (Latin) source terms
  }
  terms.sort((a, b) => b.term.length - a.term.length);
  phraseTermsCache = terms.map(({ term, row }) => ({
    // \b works because terms are ASCII; case-insensitive; only whole words/phrases.
    re: new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"),
    row
  }));
  phraseTermsBuiltAt = dictLoadedAt;
  return phraseTermsCache;
}

/**
 * Phrase-level central-dictionary substitution: replace every APPROVED English business term
 * inside a value with its approved translation for `lang`, longest term first; words with no
 * approved translation (genuine proper-name parts) are left exactly as-is. Returns the rewritten
 * value only if at least one approved term was substituted, else null (caller keeps the original).
 * No guessing — only whole approved terms are ever substituted.
 */
function phraseTranslate(dict: Map<string, DictRow>, raw: string, lang: SupportedLanguage): string | null {
  if (lang === "en") return null; // English selection keeps English source
  const targetCol = LANG_COL[lang] || "english_text";
  let result = raw;
  let changed = false;
  for (const { re, row } of getPhraseTerms(dict)) {
    if (!result) break;
    const target = (row[targetCol as keyof DictRow] as string | null)?.trim();
    const english = (row.english_text || "").trim();
    if (!target || target === english) continue; // no genuine translation for this language
    re.lastIndex = 0;
    if (!re.test(result)) continue;
    re.lastIndex = 0;
    result = result.replace(re, target);
    changed = true;
  }
  return changed && result !== raw ? result : null;
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

/**
 * Load the dictionary once and return a synchronous phrase translator for `lang`. Use for
 * COMPOSITE display strings that aren't a single record field (e.g. a branch label
 * "Quetta (QTA)") — it substitutes approved business/place terms and leaves the rest as-is.
 * Returns an identity function for English or when DATABASE_URL / the dictionary is unavailable.
 */
export async function getPhraseTranslator(lang: SupportedLanguage): Promise<(value: string | null | undefined) => string> {
  const identity = (v: string | null | undefined) => (v ?? "").toString();
  if (lang === "en") return identity;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return identity;
  let dict = dictCache;
  if (!dict || Date.now() - dictLoadedAt >= DICT_TTL_MS) {
    const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 8 });
    try {
      dict = await loadDictionary(sql);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => undefined);
    }
  }
  const d = dict;
  return (value) => {
    const raw = (value ?? "").toString().trim();
    if (!raw) return (value ?? "").toString();
    return phraseTranslate(d, raw, lang) ?? raw;
  };
}

function genuine(target: string | null | undefined, raw: string, english: string, isEnglishTarget = false): string | null {
  const t = (target || "").trim();
  if (!t || t === raw) return null;
  if (isEnglishTarget) return t;
  if (t !== english) return t;
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
  return genuine(d[targetCol as keyof DictRow] as string, raw, (d.english_text || "").trim(), lang === "en");
}

export async function localizeRecordNames<T extends { id: string }>(
  records: T[],
  table: string,
  field: keyof T & string,
  lang: SupportedLanguage,
  options?: {
    /**
     * Also substitute approved business TERMS inside multi-word descriptive values
     * (e.g. "Purchase Account" → "خریداری کھاتہ"), leaving genuine proper-name words as-is.
     * Off by default so existing callers keep exact-match-only behavior.
     */
    phraseFallback?: boolean;
  }
): Promise<T[]> {
  if (!records || records.length === 0) return records;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return records;
  const ids = records.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return records;

  const isEn = lang === "en";
  const targetCol = LANG_COL[lang] || "english_text";
  // Exact-match dictionary is disabled for proper-name tables, but phrase-level substitution
  // (whole approved terms only) is safe there too — it only ever replaces known business terms.
  const useDictionary = !PROPER_NAME_TABLES.has(table) || Boolean(options?.phraseFallback);

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
      const targetText = trans ? (trans[targetCol as keyof DictRow] as string) : null;
      const recVal = genuine(targetText, rawValue, englishVal, isEn);
      if (recVal) return { ...record, [field]: recVal };

      // Tier 2 — central dictionary (exact term match, approved only).
      if (dict) {
        const d = dict.get(rawValue.toLowerCase());
        if (d) {
          const dictVal = genuine(d[targetCol as keyof DictRow] as string, rawValue, (d.english_text || "").trim(), isEn);
          if (dictVal) return { ...record, [field]: dictVal };
        }

        // Tier 2b — phrase-level substitution of approved business terms inside the value,
        // so no approved English term remains visible in a non-English selection; genuine
        // proper-name words are left untouched (honest, never guessed).
        if (options?.phraseFallback || !isEn) {
          const phrase = phraseTranslate(dict, rawValue, lang);
          if (phrase) return { ...record, [field]: phrase };
        }
      }

      // Tier 3 — honest original value (English preferred when viewing in English), no guessed spelling.
      if (isEn && englishVal && englishVal !== rawValue) return { ...record, [field]: englishVal };
      return record;
    });
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

/**
 * Central multilingual-search resolver. A user searching in Urdu/Arabic/Farsi/Pashto types
 * the term in THAT language, but the master record's own column is stored in whatever
 * language it was originally entered in (often English/the creator's language) — a plain
 * ILIKE on the raw column never matches. This checks `record_translations` for a match in
 * ANY of the 5 language columns and returns the underlying `record_id`s, so callers can
 * UNION them with their own direct-column ILIKE matches and resolve to the same records
 * regardless of which language the search term or the stored value happens to be in.
 *
 * One shared implementation for the whole ERP — every search endpoint (goods, customers,
 * accounts, banks, warehouses, ...) should call this rather than reimplementing per-page
 * multilingual matching.
 */
export async function searchRecordIdsByTranslation(
  table: string,
  fields: string[],
  searchTerm: string,
  limit = 200
): Promise<string[]> {
  const term = (searchTerm || "").trim();
  if (!term || fields.length === 0) return [];
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return [];

  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 8 });
  try {
    const like = `%${term}%`;
    const rows = await sql.unsafe(
      `select distinct record_id
       from record_translations
       where record_table = $1 and field_name = any($2::text[]) and deleted_at is null
         and (english_text ilike $3 or urdu_text ilike $3 or arabic_text ilike $3
              or persian_text ilike $3 or pashto_text ilike $3 or original_text ilike $3)
       limit $4`,
      [table, fields, like, limit]
    );
    return (rows as unknown as Array<{ record_id: string }>).map((r) => r.record_id);
  } catch {
    // Search-widening is a nice-to-have; a lookup failure should never break the base search.
    return [];
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
