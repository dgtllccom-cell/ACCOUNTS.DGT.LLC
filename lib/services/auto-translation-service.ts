import { type SupportedLanguage } from "@/lib/i18n/languages";
import { translateText } from "./multilingual-service";
import { transliterateProperNoun, transliterateToLatin } from "@/lib/i18n/transliteration";
import { detectScriptType } from "@/lib/i18n/multilingual-translator";

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
 *
 * `mode` (from the field registry, lib/i18n/translatable-fields.ts):
 *   - "translate": descriptive phrases. Dictionary match only; unmatched text is left as-is
 *     (transliterating a phrase like "Employee Reports" would produce nonsense, not a
 *     translation — an unmatched phrase needs a real human/dictionary addition, not a guess).
 *   - "transliterate": proper nouns (place/person names). Dictionary match first (covers the
 *     curated common cases exactly, e.g. the 5 ERP countries); anything NOT in the dictionary
 *     falls through to the rule-based phonetic transliterator instead of echoing English —
 *     this is what closes the "5,492 records were just English copied 5x" gap.
 */
export async function autoTranslateText(
  originalText: string,
  _originalLanguage: SupportedLanguage,
  mode: "translate" | "transliterate" = "translate"
): Promise<TranslationMap> {
  const val = originalText.trim();
  if (!val) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const resolved = translateText(val);
  const dictionaryHit = resolved.ur !== val || resolved.ar !== val || resolved.fa !== val || resolved.ps !== val;

  if (dictionaryHit || mode !== "transliterate") {
    return {
      en: resolved.en || val,
      ur: resolved.ur || val,
      ar: resolved.ar || val,
      fa: resolved.fa || val,
      ps: resolved.ps || val
    };
  }

  // Source script determines which direction to transliterate. Perso-Arabic-script input
  // (Urdu/Arabic/Persian/Pashto all share the same base script) has no forward path to
  // English — without this branch, `en` fell back to the raw original text, meaning selecting
  // English UI would still display the Urdu/Arabic/Farsi/Pashto source (a real leak). ur/ar/fa/ps
  // keep the original script as-is (cross-RTL letter differences, e.g. Urdu ٹ/ڈ/ڑ vs standard
  // Arabic, are a further refinement — not attempted here, matching the forward direction's own
  // scope).
  if (detectScriptType(val) === "arabic") {
    return {
      en: transliterateToLatin(val),
      ur: val,
      ar: val,
      fa: val,
      ps: val
    };
  }

  return {
    en: val,
    ur: transliterateProperNoun(val, "ur"),
    ar: transliterateProperNoun(val, "ar"),
    fa: transliterateProperNoun(val, "fa"),
    ps: transliterateProperNoun(val, "ps")
  };
}
