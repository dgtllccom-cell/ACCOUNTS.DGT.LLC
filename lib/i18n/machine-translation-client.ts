import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Real machine-translation tier for the Central Translation Resolver.
 *
 * The pre-existing `autoTranslate5Languages` (lib/i18n/multilingual-translator.ts) is a
 * dictionary word/phrase substitution matcher, not a translator — anything outside its
 * fixed term list is left untouched or phonetically transliterated. For free-text fields
 * (narration, remarks, goods descriptions — anything registered `mode: "translate"` in
 * lib/i18n/translatable-fields.ts) that produces unreadable output for real sentences.
 *
 * This client calls the Google Cloud Translation API v2 (REST, API-key auth — no service
 * account/OAuth setup needed) as the last-resort tier BEFORE falling back to the crude
 * matcher, per the resolution hierarchy: Dictionary -> Translation Memory -> Approved
 * Record Translation -> Machine Translation -> (only if MT is unavailable) crude fallback.
 *
 * Never used for `mode: "transliterate"` fields (proper nouns: company/person/place names)
 * — translating a name is wrong regardless of engine quality; that policy is unrelated to
 * MT and enforced by the caller, not here.
 *
 * Safe by design: returns null (never throws) when GOOGLE_TRANSLATE_API_KEY isn't
 * configured or the API call fails, so every existing caller's fallback chain keeps
 * working unchanged until a key is added.
 */

const GOOGLE_TRANSLATE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

// Google Cloud Translation language codes for our 5 supported languages.
// Google uses "fa" for Persian/Farsi and "ps" for Pashto — same codes we already use.
const GOOGLE_LANG_CODE: Record<SupportedLanguage, string> = {
  en: "en",
  ur: "ur",
  ar: "ar",
  fa: "fa",
  ps: "ps"
};

type CacheEntry = { value: string; expiresAt: number };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — free text is often repeated (e.g. common remarks)
const cache = new Map<string, CacheEntry>();

function cacheKey(text: string, sourceLang: SupportedLanguage, targetLang: SupportedLanguage) {
  return `${sourceLang}>${targetLang}:${text}`;
}

function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);
}

/**
 * Translate a single string into a single target language via Google Cloud Translation.
 * Returns null (never throws) if unconfigured, the languages aren't supported by Google's
 * mapping above, the call fails, or Google returns an empty/error response.
 */
export async function translateViaMachineTranslation(
  text: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed || sourceLang === targetLang) return null;
  if (!isConfigured()) return null;

  const key = cacheKey(trimmed, sourceLang, targetLang);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY!;
    const params = new URLSearchParams({
      key: apiKey,
      q: trimmed,
      source: GOOGLE_LANG_CODE[sourceLang],
      target: GOOGLE_LANG_CODE[targetLang],
      format: "text"
    });
    const response = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?${params.toString()}`, {
      method: "POST",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.warn(`[MachineTranslation] Google Translate API error ${response.status} for ${sourceLang}->${targetLang}`);
      return null;
    }
    const data = await response.json();
    const translated: string | undefined = data?.data?.translations?.[0]?.translatedText;
    if (!translated || !translated.trim()) return null;

    cache.set(key, { value: translated.trim(), expiresAt: Date.now() + CACHE_TTL_MS });
    return translated.trim();
  } catch (err) {
    console.warn(`[MachineTranslation] Failed to translate ${sourceLang}->${targetLang}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Translate one string into every one of the 5 supported languages except the source.
 * Returns a partial map — languages where MT is unavailable/failed are simply absent,
 * so callers can fall back to the existing crude matcher only for those gaps.
 */
export async function translateToAllLanguages(
  text: string,
  sourceLang: SupportedLanguage
): Promise<Partial<Record<SupportedLanguage, string>>> {
  if (!isConfigured()) return {};
  const targets = (Object.keys(GOOGLE_LANG_CODE) as SupportedLanguage[]).filter((lang) => lang !== sourceLang);
  const results = await Promise.all(
    targets.map(async (target) => [target, await translateViaMachineTranslation(text, sourceLang, target)] as const)
  );
  const map: Partial<Record<SupportedLanguage, string>> = {};
  for (const [lang, value] of results) {
    if (value) map[lang] = value;
  }
  return map;
}

export function isMachineTranslationConfigured(): boolean {
  return isConfigured();
}
