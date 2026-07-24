import { type SupportedLanguage } from "@/lib/i18n/languages";
import { translateText } from "./multilingual-service";

export type TranslationMap = {
  en: string;
  ur: string;
  ar: string;
  fa: string;
  ps: string;
};

/**
 * Resolves translations using the ERP's local translation dictionary and offline database engine.
 * Completely offline, local server operation — no AI or third-party external API requests.
 */
export async function autoTranslateText(
  originalText: string,
  _originalLanguage: SupportedLanguage
): Promise<TranslationMap> {
  const val = originalText.trim();
  if (!val) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const resolved = translateText(val);

  return {
    en: resolved.en || val,
    ur: resolved.ur || val,
    ar: resolved.ar || val,
    fa: resolved.fa || val,
    ps: resolved.ps || val
  };
}
