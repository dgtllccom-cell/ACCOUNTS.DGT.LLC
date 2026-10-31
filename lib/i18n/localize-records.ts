import postgres from "postgres";
import { getSharedPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { transliterateToLatin, transliterateProperNoun } from "@/lib/i18n/transliteration";
import { TRANSLATABLE_FIELDS } from "@/lib/i18n/translatable-fields";
import { VALUE_TRANSLATIONS, translateCountry, vocabularyFor, registerApprovedVocabulary } from "@/lib/i18n/table-values";
// the central UI dictionary registers itself into the shared vocabulary when it loads
import "@/lib/i18n/ui";
import { TRUSTED_TRANSLATION_ENGINES, isAuthorizedNameTranslation } from "@/lib/i18n/customer-name";

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
  "states_provinces", "countries", "areas_locations",
  "erp_locations", "route_templates"
]);

type DictRow = {
  english_text: string | null; urdu_text: string | null; arabic_text: string | null;
  persian_text: string | null; pashto_text: string | null;
  translation_status?: string | null; translated_by_engine?: string | null;
  /** record_translations.source (enum, cast to text) and corrected_by — needed for the customer-name authorization rule */
  source?: string | null; corrected_by?: string | null;
  original_text?: string | null;
};

// ── Stored-translation trust: ONE rule for every reader ────────────────────────────────────────────────────────────
// Owner rule (2026-10-27, issue #36): a viewer sees an APPROVED translation of saved data — a person's entry or correction,
// an explicitly verified row, or an admin import — never an unverified machine rendering presented as if it were approved.
//  - Legal names (customer / account / company / bank / employee / person names): approved variant, else exactly the saved name.
//  - Free text and terms: approved translation; a machine rendering only when it was made FROM ENGLISH and is clean in the
//    viewer's script (the local dictionary renders English terms reliably). A machine rendering of text typed in Urdu / Pashto /
//    Persian / Arabic is never shown — those engines re-spell words ("Namt Allah", "Warehouse کیٹگری", "ٹرانسPort").
//    Known terms in any language still resolve through the approved dictionaries (vocabulary tier below).
//  - Place names keep the curated dictionary / script rendering they had (Location Management is curated data).
// (the name-authorization list lives in lib/i18n/customer-name.ts so the Customer Register and this resolver share one definition)

/** A stored record_translations row that a person entered, corrected, verified or imported — shown as-is. */
export function isApprovedStoredTranslation(row: Pick<DictRow, "source" | "translation_status" | "translated_by_engine" | "corrected_by"> | null | undefined): boolean {
  if (!row) return false;
  if (isAuthorizedNameTranslation({
    source: row.source, translation_status: row.translation_status, translated_by_engine: row.translated_by_engine, human_corrected: Boolean(row.corrected_by)
  })) return true;
  // a Super Admin bulk import through Translation Management (source 'imported', status 'complete'); the DB enrolment trigger
  // writes 'imported' + 'pending' copies of the original, which are NOT translations
  return String(row.source || "").toLowerCase() === "imported" && String(row.translation_status || "").toLowerCase() === "complete";
}

const UNRESOLVED_MACHINE_STATUSES = new Set(["needs_review", "pending", "rejected", "failed"]);
const LEFTOVER_ENGLISH_RE = /\p{Lu}?[a-z]{2,}/u;

/** A machine rendering stored for free text: usable only when made from English and clean in the target script. */
function usableMachineTranslation(row: DictRow, raw: string, lang: SupportedLanguage): boolean {
  if (UNRESOLVED_MACHINE_STATUSES.has(String(row.translation_status || "").toLowerCase())) return false;
  if (ARABIC_SCRIPT_RE.test(raw)) return false; // typed in UR / PS / FA / AR — no machine re-spelling is shown
  const target = String(row[LANG_COL[lang] as keyof DictRow] || "");
  if (lang === "en") return !ARABIC_SCRIPT_RE.test(target);
  return !LEFTOVER_ENGLISH_RE.test(target); // no half-English rendering
}

/** Place names keep the curated dictionary rows they always used (dictionary rows without metadata included). */
function isTrustedPlaceTranslation(row: { translation_status?: string | null; translated_by_engine?: string | null } | undefined): boolean {
  if (!row) return true;
  const status = (row.translation_status || "").toLowerCase();
  if (status === "human_verified" || status === "verified") return true;
  if (UNRESOLVED_MACHINE_STATUSES.has(status)) return false;
  const eng = (row.translated_by_engine || "").toLowerCase();
  return eng === "" || TRUSTED_TRANSLATION_ENGINES.has(eng);
}

/**
 * The value a stored record_translations row gives for `lang`, or null when the row is not one a viewer may see as the
 * translation (see the trust rule above). Shared by the resolver below and every API that reads record_translations directly
 * (ledger reports, Roznamcha, purchase / sales orders), so all screens agree.
 */
export function trustedStoredTranslation(
  table: string,
  field: string,
  rawValue: string | null | undefined,
  row: DictRow | null | undefined,
  lang: SupportedLanguage
): string | null {
  const raw = String(rawValue ?? row?.original_text ?? "").trim();
  if (!row || !raw) return null;
  const legal = isLegalName(table, field);
  const proper = isProperNounField(table, field);
  let usable = isApprovedStoredTranslation(row);
  if (!usable && !legal) usable = proper ? isTrustedPlaceTranslation(row) : usableMachineTranslation(row, raw, lang);
  if (!usable) return null;
  const target = row[LANG_COL[lang] as keyof DictRow] as string | null | undefined;
  return genuine(target, raw, String(row.english_text || "").trim(), lang === "en");
}

/** The languages of a stored row a client may show (for APIs that ship a `translations` map to the screen). */
export function trustedTranslationMap(
  table: string,
  field: string,
  rawValue: string | null | undefined,
  row: DictRow | null | undefined
): Partial<Record<SupportedLanguage, string>> {
  const out: Partial<Record<SupportedLanguage, string>> = {};
  for (const lang of ["en", "ur", "ar", "fa", "ps"] as SupportedLanguage[]) {
    const value = trustedStoredTranslation(table, field, rawValue, row, lang);
    if (value) out[lang] = value;
  }
  return out;
}

// ── Display-only proper-name script rendering ─────────────────────────────────
// When a record has NO genuine approved translation for the viewer's language, a
// proper name (person / company / place / bank / vessel) must still be shown in
// the VIEWER'S script — an English viewer should never see a name in Perso-Arabic
// script and vice-versa. This is a DISPLAY fallback only: it is never written to
// the database, and it is applied *after* every genuine-translation tier. Free
// text (mode "translate": categories, descriptions, notes, narration) is NEVER
// transliterated — it stays exactly as entered until a real translation exists.
const ARABIC_SCRIPT_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_LETTER_RE = /[A-Za-z]/;

// Account, customer / Person Master, company, bank and branch names are LEGAL names (owner rule 2026-10-24, extended 2026-10-26 to
// companies, banks and branches): the display shows an authorized translation for the viewer's language, otherwise the saved name —
// the tier-4 script-rendering below is never applied to them, so every screen agrees with the Customer Register
// (lib/i18n/customer-name.ts) and the pickers (localizeName). Ports, cities and other places keep the display rendering.
// null = every field of the table is a legal name; otherwise only the listed name fields (a company's city / country stay places).
const LEGAL_NAME_FIELDS: Record<string, ReadonlySet<string> | null> = {
  // a customer's address / notes are not names (they follow the free-text rule)
  customers: new Set(["customer_name", "first_name", "last_name", "father_name", "company_name", "contact_person", "native_customer_name", "name", "legal_name"]),
  accounts: null, enterprise_accounts: null, ledgers: null,
  companies: new Set(["name", "legal_name", "owner_name"]),
  banks: new Set(["bank_name", "branch_name", "short_name", "account_title"]),
  city_branches: new Set(["name", "owner_name"]),
  country_branches: new Set(["name", "owner_name"]),
  // employees are people: their names follow the same rule (designation / department stay translatable terms)
  employees: new Set(["customer_name", "full_name", "first_name", "last_name", "father_name", "name"])
};
// A PERSON / party name in any module (truck owner and driver, receiver / sender, consignee, contact person, supplier, buyer, …) is
// a name too: the same approved-variant-else-saved-name rule, so "نصراللہ استاد" never shows as the machine guess "NsrAllah Astad".
// Matched on the field (its last segment for JSON paths such as "payment.receiver_sender_name"); place fields never match.
const PERSON_NAME_FIELD_RE = /(^|_)(full|first|last|father|owner|driver|customer|party|supplier|importer|exporter|buyer|consignee|consignor|notify_party|agent|super_agent|actor|user|signature|receipt|lead|company|legal|registered|carrier|hr_manager|person_account|account|truck_owner|truck_driver|approved_by|uploaded_by|consumed_by|responsible_user|party_customer|party_company|receiver_sender|sender|receiver|beneficiary|payee|holder)_name$|(^|_)contact_person$|(^|_)transport_company$|^owner_name_(en|ur|ar|fa|ps)$/;

/** A legal name: authorized translation, else exactly the saved name — no word-by-word dictionary substitution, no script rendering. */
export function isLegalName(table: string, field: string): boolean {
  if (table in LEGAL_NAME_FIELDS) {
    const fields = LEGAL_NAME_FIELDS[table];
    if (!fields || fields.has(field)) return true;
  }
  const leaf = field.includes(".") ? field.slice(field.lastIndexOf(".") + 1) : field;
  return PERSON_NAME_FIELD_RE.test(leaf);
}

// (table, field) -> mode. "transliterate" = proper noun (script-render on display).
const FIELD_MODE = new Map<string, "translate" | "transliterate">();
for (const [table, defs] of Object.entries(TRANSLATABLE_FIELDS)) {
  for (const d of defs) FIELD_MODE.set(`${table}::${d.field}`, d.mode);
}

/** True when a (table, field) holds a proper noun that should be rendered in the
 *  viewer's script when no approved translation exists. */
function isProperNounField(table: string, field: string): boolean {
  const m = FIELD_MODE.get(`${table}::${field}`);
  if (m) return m === "transliterate";
  // Not in the registry: proper-name master tables default to script-rendering,
  // everything else is treated as free text (no transliteration guess).
  return PROPER_NAME_TABLES.has(table);
}

/** A value we must NEVER transliterate — codes, refs, account/bill numbers,
 *  emails, digit-heavy strings. Names (letters + spaces) pass through. */
function isBusinessIdentifier(v: string): boolean {
  if (!v) return true;
  if (!/\p{L}/u.test(v)) return true;                 // no letters → pure number/code
  if (/[@#]/.test(v) || /https?:\/\//i.test(v)) return true;
  const digits = (v.match(/\d/g) || []).length;
  if (digits > 0 && digits / v.replace(/\s/g, "").length >= 0.3) return true;
  // Dashed/underscored/slashed code with digits: UAE-DUB-AC-0001, PER-000087
  if (/[-_/]/.test(v) && /^[A-Za-z0-9][A-Za-z0-9\s._/-]*$/.test(v) && /\d/.test(v)) return true;
  // Dashed all-caps code without digits: SO-DD-VERIFY, BL/NO, CN-REF
  if (/^[A-Z][A-Z0-9]*([-_/][A-Z][A-Z0-9]*){2,}$/.test(v.replace(/\s/g, ""))) return true;
  return false;
}

/** DISPLAY-ONLY: render a proper-name value in `lang`'s script when there is no
 *  approved translation. Returns null when no safe rendering applies.
 *
 *  Policy (MULTILINGUAL BUSINESS DATA CONTRACT — the write side stays the source of truth;
 *  this is the "Local Translator" display tier, above "safe original fallback"):
 *   - EN viewer + a Perso-Arabic-script name -> transliterate to Latin. An English
 *     reader genuinely cannot read the Arabic script; Latin is universal.
 *   - UR / AR / FA / PS viewer + a Latin-script name -> render it into the viewer's
 *     script (transliterateProperNoun, which carries authentic-name dictionaries +
 *     canonical corrections). A name typed in English must not stay permanently English
 *     for a Perso-Arabic reader. A genuine curated Tier-1 translation still wins.
 *   - UR / AR / FA / PS viewer + a name already in ANY Perso-Arabic script -> keep as-is
 *     (the four scripts are mutually legible; re-spelling would only add noise).
 *  In every case: display-only, NEVER written back, and skipped for values that look like
 *  a business identifier / embedded code (isBusinessIdentifier) so codes stay intact. */
function properNameForDisplay(raw: string, lang: SupportedLanguage): string | null {
  const v = (raw || "").trim();
  if (!v || isBusinessIdentifier(v)) return null;

  if (lang === "en") {
    if (!ARABIC_SCRIPT_RE.test(v)) return null;          // already Latin
    const out = transliterateToLatin(v).trim();
    if (!out || out.toLowerCase() === v.toLowerCase()) return null;
    if (ARABIC_SCRIPT_RE.test(out) || !LATIN_LETTER_RE.test(out)) return null;  // incomplete render
    return out;
  }

  // ur / ar / fa / ps
  if (ARABIC_SCRIPT_RE.test(v)) return null;             // already in a legible Perso-Arabic script
  if (!LATIN_LETTER_RE.test(v)) return null;             // no letters to render (pure digits/punct)
  const out = transliterateProperNoun(v, lang).trim();
  if (!out || out === v) return null;
  if (!ARABIC_SCRIPT_RE.test(out) || LATIN_LETTER_RE.test(out)) return null;  // render incomplete → keep original
  return out;
}

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
  const map = new Map<string, DictRow>();

  // Seed dictionary with curated static vocabulary (countries, statuses, common terms)
  for (const [k, v] of Object.entries(VALUE_TRANSLATIONS)) {
    const key = k.toLowerCase().trim();
    if (key) {
      map.set(key, {
        english_text: k,
        urdu_text: v.ur,
        arabic_text: v.ar,
        persian_text: v.fa,
        pashto_text: v.ps,
        translation_status: "verified",
        translated_by_engine: "local_dictionary"
      });
    }
  }

  const rows = await sql.unsafe(
    `select english_text, original_text, urdu_text, arabic_text, persian_text, pashto_text
     from record_translations
     where record_table = 'system_dictionary' and deleted_at is null
       and coalesce(translation_status,'') <> 'needs_review'`
  ).catch(() => [] as any[]);
  for (const r of rows as any[]) {
    const key = String(r.english_text || r.original_text || "").trim().toLowerCase();
    if (key) map.set(key, r);
  }
  // the same approved rows answer a term SAVED in another language (vocabulary index in table-values.ts)
  registerApprovedVocabulary((rows as any[]).map((r) => ({
    en: String(r.english_text || r.original_text || "").trim(), ur: r.urdu_text ?? undefined, ar: r.arabic_text ?? undefined,
    fa: r.persian_text ?? undefined, ps: r.pashto_text ?? undefined
  })));
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
  let dict = dictCache;
  if (!dict || Date.now() - dictLoadedAt >= DICT_TTL_MS) {
    if (dbUrl) {
      const sql = getSharedPg()!;
      try {
        dict = await loadDictionary(sql);
      } catch {
        // Fallback to static dictionary when DB fails
        const map = new Map<string, DictRow>();
        for (const [k, v] of Object.entries(VALUE_TRANSLATIONS)) {
          const key = k.toLowerCase().trim();
          if (key) {
            map.set(key, {
              english_text: k,
              urdu_text: v.ur,
              arabic_text: v.ar,
              persian_text: v.fa,
              pashto_text: v.ps
            });
          }
        }
        dict = map;
      }
    } else {
      const map = new Map<string, DictRow>();
      for (const [k, v] of Object.entries(VALUE_TRANSLATIONS)) {
        const key = k.toLowerCase().trim();
        if (key) {
          map.set(key, {
            english_text: k,
            urdu_text: v.ur,
            arabic_text: v.ar,
            persian_text: v.fa,
            pashto_text: v.ps
          });
        }
      }
      dict = map;
    }
  }
  const d = dict;
  return (value) => {
    const raw = (value ?? "").toString().trim();
    if (!raw) return (value ?? "").toString();
    const translated = phraseTranslate(d, raw, lang);
    if (translated) return translated;
    const country = translateCountry(raw, lang);
    if (country && country !== raw) return country;
    return raw;
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
    const sql = getSharedPg()!;
    try {
      dict = await loadDictionary(sql);
    } finally {
      /* shared process-lifetime pool — deliberately not closed */ void 0;
    }
  }
  const d = dict.get(raw.toLowerCase());
  if (!d) return null;
  const targetCol = LANG_COL[lang] || "english_text";
  return genuine(d[targetCol as keyof DictRow] as string, raw, (d.english_text || "").trim(), lang === "en");
}

/**
 * True when the caller wants the ORIGINAL, untranslated record — i.e. an EDIT
 * FORM, which must always load the source-of-truth text so saving it back never
 * overwrites the original with a display translation. Detail/profile VIEWS and
 * lists/reports omit this and get the localized display value.
 * Recognises `?raw=1`, `?raw=true`, `?localize=0`, `?localize=false`.
 */
export function wantsRawRecord(request: { nextUrl: { searchParams: URLSearchParams } } | URLSearchParams): boolean {
  const sp = request instanceof URLSearchParams ? request : request.nextUrl.searchParams;
  const raw = (sp.get("raw") || "").toLowerCase();
  const loc = (sp.get("localize") ?? "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || loc === "0" || loc === "false" || loc === "no";
}

type ResolveContext = {
  table: string;
  lang: SupportedLanguage;
  dict: Map<string, DictRow> | null;
  phraseFallback?: boolean;
  noPhrase?: boolean;
};

/**
 * Resolve ONE saved value of (table, field) into the viewer's language — the single resolution path behind
 * localizeRecordNames / localizeRecordFields / localizeRecordGroups (they used to carry three drifting copies of it).
 * Returns the display value, or null to keep the saved value.
 *
 *  1. this record's own stored translation, when the trust rule allows it (trustedStoredTranslation)
 *  2. approved central dictionary, exact term ("Cash"); legal names stop here — approved variant or the saved name
 *  3. the same approved term SAVED in another language (vocabulary), then whole approved English terms inside the value
 *     (phrase tier, English source only)
 *  4. place names only: display-only script rendering
 */
function resolveSavedValue(ctx: ResolveContext, field: string, rawValue: string, trans: DictRow | undefined): string | null {
  const { table, lang, dict } = ctx;
  const isEn = lang === "en";
  const targetCol = LANG_COL[lang] || "english_text";
  const legal = isLegalName(table, field);
  const proper = isProperNounField(table, field);

  const stored = trustedStoredTranslation(table, field, rawValue, trans, lang);
  if (stored) return stored;

  if (table === "countries" && field === "name" && !isEn) {
    const cName = translateCountry(rawValue, lang);
    if (cName && cName !== rawValue) return cName;
  }

  if (dict) {
    const d = dict.get(rawValue.toLowerCase());
    if (d) {
      const dictVal = genuine(d[targetCol as keyof DictRow] as string, rawValue, (d.english_text || "").trim(), isEn);
      if (dictVal) return dictVal;
    }
  }
  if (legal) return null;

  // a term SAVED in Urdu / Pashto / Persian / Arabic ("گودام", "پارٹی", "موبائل فون"): the same approved term in the viewer's language
  if (dict && ARABIC_SCRIPT_RE.test(rawValue)) {
    const term = vocabularyFor(lang, rawValue);
    if (term) return term;
  }

  if (dict && !ctx.noPhrase && (ctx.phraseFallback || !isEn)) {
    const phrase = phraseTranslate(dict, rawValue, lang);
    if (phrase) return phrase;
  }

  // DISPLAY-ONLY proper-name script rendering for places (never names of people / parties, never written back)
  if (proper && !ctx.noPhrase) {
    const disp = properNameForDisplay(rawValue, lang);
    if (disp) return disp;
  }
  return null;
}

async function loadStoredTranslations(
  sql: ReturnType<typeof postgres>,
  table: string,
  fields: string[],
  ids: string[]
): Promise<Map<string, DictRow>> {
  const rows = await sql.unsafe(
    `select record_id, field_name, original_text, english_text, urdu_text, arabic_text, persian_text, pashto_text,
            translation_status, translated_by_engine, source::text as source, corrected_by
     from record_translations
     where record_table = $1 and field_name = any($2::text[]) and deleted_at is null
       and record_id = any($3::uuid[])`,
    [table, fields, ids]
  ).catch(() => [] as any[]);
  const byIdField = new Map<string, DictRow>();
  for (const r of rows as any[]) byIdField.set(`${r.record_id}::${r.field_name}`, r);
  return byIdField;
}

function localizeRows<T extends { id: string }>(
  records: T[],
  fields: string[],
  ctx: ResolveContext,
  stored: Map<string, DictRow>
): T[] {
  return records.map((record) => {
    let next: T | null = null;
    for (const field of fields) {
      const rawValue = String((record as any)[field] ?? "").trim();
      if (!rawValue) continue;
      const resolved = resolveSavedValue(ctx, field, rawValue, stored.get(`${record.id}::${field}`));
      if (resolved && resolved !== rawValue) next = { ...(next ?? record), [field]: resolved };
    }
    return next ?? record;
  });
}

/** The dictionary a table may use: exact-term lookups are off for proper-name tables unless the caller opts into phrases. */
function dictionaryAllowed(table: string, phraseFallback?: boolean): boolean {
  return !PROPER_NAME_TABLES.has(table) || Boolean(phraseFallback);
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
  return localizeRecordFields(records, table, [field], lang, options);
}

/**
 * Batched multi-field variant of {@link localizeRecordNames}. Resolves SEVERAL fields of
 * the same record set in ONE database connection + ONE `record_translations` query,
 * instead of calling `localizeRecordNames` once per field (which opened, authenticated
 * and closed a fresh pooled connection every time — ~2 s each against the remote pooler,
 * so a 6-field route spent ~12 s just on connection churn). Same resolution (resolveSavedValue).
 */
export async function localizeRecordFields<T extends { id: string }>(
  records: T[],
  table: string,
  fields: (keyof T & string)[],
  lang: SupportedLanguage,
  options?: {
    phraseFallback?: boolean;
    /**
     * Disable Tier-2b phrase substitution entirely (even for non-English). Use for
     * short proper-name-ish fields (brand / variety / size codes) where the token-level
     * dictionary rewrite does more harm than good — a genuine record translation still
     * applies, otherwise the raw value is kept untouched instead of being mangled.
     */
    noPhrase?: boolean;
  }
): Promise<T[]> {
  if (!records?.length || !fields.length) return records;
  if (!process.env.DATABASE_URL) return records;
  const ids = records.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return records;

  const sql = getSharedPg()!;
  try {
    const stored = await loadStoredTranslations(sql, table, fields, ids);
    const dict = dictionaryAllowed(table, options?.phraseFallback) ? await loadDictionary(sql) : null;
    return localizeRows(records, fields, { table, lang, dict, phraseFallback: options?.phraseFallback, noPhrase: options?.noPhrase }, stored);
  } finally {
    /* shared process-lifetime pool — deliberately not closed */ void 0;
  }
}

export type LocalizeGroup<T extends { id: string } = { id: string }> = {
  records: T[];
  table: string;
  fields: (keyof T & string)[];
  phraseFallback?: boolean;
};

/**
 * Localize SEVERAL unrelated record sets (different tables) in ONE database connection.
 * A route that localizes employees + persons + countries + branches used to call
 * {@link localizeRecordNames} once per (table, field) pair — each opening, authenticating
 * and closing a fresh pooled connection (~2 s against the remote pooler), so a 6-call
 * route spent ~12 s purely on connection churn. This runs one translations query per
 * group over a single shared connection. Returns arrays parallel to `groups` (same order),
 * each the localized copy of that group's records.
 */
export async function localizeRecordGroups(
  groups: LocalizeGroup<any>[],
  lang: SupportedLanguage
): Promise<any[][]> {
  const active = groups.map((g) => ({ ...g, ids: (g.records || []).map((r) => r.id).filter(Boolean) }));
  if (!process.env.DATABASE_URL || active.every((g) => !g.records?.length || !g.fields?.length || !g.ids.length)) {
    return groups.map((g) => g.records);
  }
  const sql = getSharedPg()!;
  try {
    const needDict = active.some((g) => g.records?.length && g.fields?.length && g.ids.length && dictionaryAllowed(g.table, g.phraseFallback));
    const dict = needDict ? await loadDictionary(sql) : null;
    const out: any[][] = [];
    for (const g of active) {
      if (!g.records?.length || !g.fields?.length || !g.ids.length) {
        out.push(g.records);
        continue;
      }
      const stored = await loadStoredTranslations(sql, g.table, g.fields, g.ids);
      const groupDict = dictionaryAllowed(g.table, g.phraseFallback) ? dict : null;
      out.push(localizeRows(g.records, g.fields, { table: g.table, lang, dict: groupDict, phraseFallback: g.phraseFallback }, stored));
    }
    return out;
  } finally {
    /* shared process-lifetime pool — deliberately not closed */ void 0;
  }
}

/**
 * Localize DENORMALIZED join-name columns on a row set — the `{ <x>_id, <x>_name }`
 * pairs that list/detail queries carry from a `JOIN` (country_name, state_province_name,
 * city_name, district_name, port_name, branch_name, …). Each mapping names the FK column,
 * the display column and the master table it points at; every distinct id is resolved
 * ONCE per table (one `record_translations` query per table, not per row), through the
 * same 4-tier resolver as {@link localizeRecordFields}.
 *
 * Use this in every list/detail API that surfaces a joined location or party name so the
 * whole row follows the viewer's language, not just the primary record's own name.
 */
export async function localizeJoinedNames<T extends Record<string, any>>(
  rows: T[],
  lang: SupportedLanguage,
  mappings: { idField: string; nameField: string; table: string; field?: string }[],
): Promise<T[]> {
  if (!rows?.length || !mappings.length) return rows;
  if (!process.env.DATABASE_URL) return rows;

  // one resolve pass per (table, field) — dedupe ids across the whole row set.
  // The passes are independent (different tables) → run them concurrently so a row
  // with 4 joined names costs ~1 DB round-trip of latency, not 4 sequential ones.
  const resolvedByMapping: Array<Map<string, string>> = await Promise.all(
    mappings.map(async (m) => {
      const seen = new Map<string, string>(); // id -> raw name
      for (const r of rows) {
        const id = r[m.idField];
        const nm = r[m.nameField];
        if (id && typeof id === "string" && nm && typeof nm === "string" && !seen.has(id)) seen.set(id, nm);
      }
      if (seen.size === 0) return new Map<string, string>();
      const field = m.field ?? "name";
      const synthetic: Array<{ id: string } & Record<string, string>> = [...seen.entries()].map(([id, name]) => ({ id, [field]: name }));
      const localized = await localizeRecordFields(synthetic, m.table, [field], lang);
      const out = new Map<string, string>();
      for (const rec of localized as Array<Record<string, any>>) {
        const v = rec[field];
        if (rec.id && typeof v === "string") out.set(rec.id, v);
      }
      return out;
    }),
  );

  return rows.map((r) => {
    let next: T | null = null;
    mappings.forEach((m, i) => {
      const id = r[m.idField];
      if (!id) return;
      const localized = resolvedByMapping[i].get(id);
      if (localized && localized !== r[m.nameField]) next = { ...(next ?? r), [m.nameField]: localized };
    });
    return next ?? r;
  });
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

  const sql = getSharedPg()!;
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
    /* shared process-lifetime pool — deliberately not closed */ void 0;
  }
}

/**
 * Set form of {@link searchRecordIdsByTranslation} for endpoints that filter rows already
 * fetched (and already scope-restricted) in memory: a row whose id is in the set matches the
 * search even when its displayed name is in a different language than the term typed.
 * It only ever widens a result the caller has already authorised, so it cannot expose a
 * record outside the caller's scope. Returns null when there is no term, so callers can skip.
 */
export async function translationMatchSet(
  table: string | string[],
  fields: string[],
  searchTerm: string,
  limit = 500
): Promise<Set<string> | null> {
  const term = (searchTerm || "").trim();
  if (!term) return null;
  const tables = Array.isArray(table) ? table : [table];
  const lists = await Promise.all(tables.map((t) => searchRecordIdsByTranslation(t, fields, term, limit)));
  return new Set(lists.flat());
}

type LedgerRowIds = { ledgerId?: string | null; accountId?: string | null; companyId?: string | null };

/**
 * Cross-language matcher for ledger list rows: true when the ledger, its account or its
 * company has a stored name (any of the five languages, or the original entry) matching the
 * term. Used next to the displayed-text match so a name typed in any language finds the row.
 */
export async function ledgerRowNameMatcher(searchTerm: string): Promise<((row: LedgerRowIds) => boolean) | null> {
  const [ledgers, accounts, companies] = await Promise.all([
    translationMatchSet("ledgers", ["name"], searchTerm),
    translationMatchSet("enterprise_accounts", ["name"], searchTerm),
    translationMatchSet("companies", ["name"], searchTerm)
  ]);
  if (!ledgers) return null;
  return (row) =>
    (!!row.ledgerId && ledgers.has(row.ledgerId)) ||
    (!!row.accountId && !!accounts && accounts.has(row.accountId)) ||
    (!!row.companyId && !!companies && companies.has(row.companyId));
}
