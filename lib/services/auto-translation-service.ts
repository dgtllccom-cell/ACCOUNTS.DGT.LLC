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
 * `mode` (from the field registry, lib/i18n/translatable-fields.ts) is accepted for call-site
 * compatibility but currently does not change behavior below: both "translate" (descriptive
 * phrases) and "transliterate" (proper nouns) fall back to the same script-aware phonetic
 * transliteration when there's no dictionary hit. This used to differ — "translate" mode
 * echoed the raw original text into every language slot (including `en`) on a miss, which
 * silently leaked non-English script into the English UI for any field using that mode
 * (goods_name, category/brand/unit names, tax names, role/permission text, etc.) — the same
 * leak already fixed for "transliterate" fields, just missed here. A phonetic rendering of an
 * un-translated phrase is an imperfect translation, but never displaying the wrong script/
 * language is the harder requirement; translation quality is a separate, later improvement.
 */
export async function autoTranslateText(
  originalText: string,
  _originalLanguage: SupportedLanguage,
  _mode: "translate" | "transliterate" = "translate"
): Promise<TranslationMap> {
  const val = originalText.trim();
  if (!val) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const resolved = translateText(val);
  const dictionaryHit = resolved.ur !== val || resolved.ar !== val || resolved.fa !== val || resolved.ps !== val;

  if (dictionaryHit) {
    return {
      en: resolved.en || val,
      ur: resolved.ur || val,
      ar: resolved.ar || val,
      fa: resolved.fa || val,
      ps: resolved.ps || val
    };
  }

  // No dictionary match. Previously, "translate" mode (descriptive phrases: goods_name,
  // category_name, brand_name, unit_name, tax_name, role/permission descriptions, and every
  // other field registered as "translate" in translatable-fields.ts) stopped here and echoed
  // the RAW original text into all 5 language slots — including `en` — whenever there was no
  // dictionary hit. That's a real leak: selecting English then showed Urdu/Arabic/Persian/
  // Pashto script verbatim, the exact bug already fixed for "transliterate" mode fields
  // (customers, banks, employees' linked names, etc.) but never for "translate" mode ones.
  // Apply the same script-aware fallback regardless of mode — it does not attempt a phrase
  // translation (still not guessing at "Employee Reports"-style phrase meaning), it only
  // guarantees `en` never shows raw non-English script for either mode.

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
