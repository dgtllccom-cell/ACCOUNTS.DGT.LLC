import { type SupportedLanguage } from "@/lib/i18n/languages";
import { autoTranslate5Languages, detectScriptType } from "@/lib/i18n/multilingual-translator";

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
  originalLanguage?: SupportedLanguage,
  _mode: "translate" | "transliterate" = "translate"
): Promise<TranslationMap> {
  const val = originalText.trim();
  if (!val) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const script = detectScriptType(val);
  const detectedSourceLang = originalLanguage || (script === "arabic" ? "ur" : "en");

  const result = autoTranslate5Languages(val, detectedSourceLang);

  return {
    en: result.en || val,
    ur: result.ur || val,
    ar: result.ar || val,
    fa: result.fa || val,
    ps: result.ps || val
  };
}

