import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Customer / Person Master NAME display rule — the ONE resolver used by the Customer Register, Customer Details,
 * the shared customer pickers and any other screen that shows a customer's name.
 *
 *  - The saved name (`customers.customer_name`) is the LEGAL name. It is never overwritten, re-spelled or transliterated here.
 *  - A name in another language is shown ONLY when an AUTHORIZED translation of it is stored for the viewer's language
 *    (human-entered/corrected, an explicitly verified row, or a curated Business-Dictionary row). Machine output that is
 *    still `needs_review` / `auto_unverified` is search material, never a display name.
 *  - When no authorized version exists for the selected language the saved name is the fallback.
 *  - One name line by default. A second line only appears when the user turns on the bilingual option.
 */

export type CustomerNameVariants = Partial<Record<SupportedLanguage, string | null>>;

/** Stored-translation metadata (record_translations) that decides whether a name translation is authorized. */
export type NameTranslationMeta = {
  source?: string | null;
  translation_status?: string | null;
  translated_by_engine?: string | null;
  /** true when a person corrected/entered the row (record_translations.corrected_by is set). */
  human_corrected?: boolean | null;
};

/** Engines whose stored output is a curated/human source (same list the central record resolver trusts). */
export const TRUSTED_TRANSLATION_ENGINES: ReadonlySet<string> = new Set(["manual", "local_dictionary", "dictionary", "glossary", "human", "verified"]);
const UNRESOLVED_STATUSES: ReadonlySet<string> = new Set(["needs_review", "pending", "rejected", "failed"]);
const VERIFIED_STATUSES: ReadonlySet<string> = new Set(["human_verified", "verified", "approved"]);

/** True when the stored name translations are an authorized version (never a raw machine guess). */
export function isAuthorizedNameTranslation(meta: NameTranslationMeta | null | undefined): boolean {
  if (!meta) return false;
  if (meta.human_corrected) return true;
  if (String(meta.source || "").toLowerCase() === "manual") return true;
  const status = String(meta.translation_status || "").toLowerCase();
  if (UNRESOLVED_STATUSES.has(status)) return false;
  if (VERIFIED_STATUSES.has(status)) return true;
  const engine = String(meta.translated_by_engine || "").toLowerCase();
  return status === "complete" && TRUSTED_TRANSLATION_ENGINES.has(engine);
}

export type CustomerNameInput = {
  /** The saved (legal) name. */
  customer_name?: string | null;
  original_customer_name?: string | null;
  customer_name_en?: string | null;
  customer_name_ur?: string | null;
  customer_name_ar?: string | null;
  customer_name_fa?: string | null;
  customer_name_ps?: string | null;
  native_customer_name?: string | null;
  /** Set by the API: the stored translations of this name are an authorized version. */
  name_translation_authorized?: boolean | null;
};

export type ResolvedCustomerName = {
  /** The single name to show. */
  primary: string;
  /** The extra line that only the bilingual option shows (null when there is nothing different to show). */
  secondary: string | null;
  /** The saved legal name (always preserved; also what the fallback shows). */
  savedName: string;
  /** primary came from an authorized translation (false = the saved name is shown). */
  usedTranslation: boolean;
};

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function variantFor(row: CustomerNameInput, lang: SupportedLanguage): string {
  switch (lang) {
    case "en": return clean(row.customer_name_en);
    case "ur": return clean(row.customer_name_ur);
    case "ar": return clean(row.customer_name_ar);
    case "fa": return clean(row.customer_name_fa);
    case "ps": return clean(row.customer_name_ps);
    default: return "";
  }
}

/** The saved legal name of a customer row (`original_customer_name` is the same value, kept for older callers). */
export function savedCustomerName(row: CustomerNameInput): string {
  return clean(row.original_customer_name) || clean(row.customer_name);
}

export function resolveCustomerName(row: CustomerNameInput, lang: SupportedLanguage): ResolvedCustomerName {
  const savedName = savedCustomerName(row);
  const authorized = Boolean(row.name_translation_authorized);
  const translated = authorized ? variantFor(row, lang) : "";
  const usedTranslation = Boolean(translated) && translated !== savedName;
  const primary = translated || savedName;

  // Bilingual option: show the OTHER representation of the same name — the saved name when a translation is primary,
  // otherwise the stored English (or native-script) rendering of the saved name. Search/Compare material only.
  const candidates = usedTranslation
    ? [savedName]
    : [clean(row.customer_name_en), clean(row.native_customer_name), clean(row.customer_name_ur), clean(row.customer_name_ar)];
  const secondary = candidates.find((candidate) => candidate && candidate !== primary) || null;

  return { primary, secondary, savedName, usedTranslation };
}

/** localStorage key of the per-user "show both names" option (default OFF). */
export const BILINGUAL_NAMES_STORAGE_KEY = "erp_customer_bilingual_names";

export function readBilingualNamesPreference(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(BILINGUAL_NAMES_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeBilingualNamesPreference(value: boolean): void {
  try {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(BILINGUAL_NAMES_STORAGE_KEY, "1");
    else window.localStorage.removeItem(BILINGUAL_NAMES_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("erp:customer-bilingual-names", { detail: value }));
  } catch {
    /* storage unavailable (private window) — the option simply stays off */
  }
}
