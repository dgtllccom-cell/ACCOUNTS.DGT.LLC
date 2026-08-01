import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface MultilingualText {
  en: string;
  ur: string;
  ar: string;
  fa: string;
  ps: string;
}

/**
 * Transliteration dictionary maps common names/terms into 5 languages.
 */
const COMMON_TRANSLITERATION_MAP: Record<string, MultilingualText> = {
  // Common Owners / Drivers Names
  "ahmed": { en: "Ahmed", ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  "muhammad": { en: "Muhammad", ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  "khan": { en: "Khan", ur: "خان", ar: "خان", fa: "خان", ps: "خان" },
  "ali": { en: "Ali", ur: "علی", ar: "علي", fa: "علی", ps: "علي" },
  "hassan": { en: "Hassan", ur: "حسن", ar: "حسن", fa: "حسن", ps: "حسن" },
  "tariq": { en: "Tariq", ur: "طارق", ar: "طارق", fa: "طارق", ps: "طارق" },
  "gulistan": { en: "Gulistan", ur: "گلستان", ar: "جليستان", fa: "گلستان", ps: "ګلستان" },
  "damaan": { en: "Damaan", ur: "دامان", ar: "ضمان", fa: "دامان", ps: "دامان" },
  "quetta": { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" },
  "chaman": { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  "kabul": { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  "dubai": { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  "karachi": { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" },
  "peshawar": { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  "transport": { en: "Transport Co.", ur: "ٹرانسپورٹ کمپنی", ar: "شركة النقل", fa: "شرکت حمل و نقل", ps: "د ټرانسپورټ شرکت" },
};

/**
 * Detect script direction / character set.
 */
export function detectScriptType(text: string): "latin" | "arabic" | "other" {
  if (!text || !text.trim()) return "latin";
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicRegex.test(text)) return "arabic";
  return "latin";
}

/**
 * Automatically generates 5-language values (en, ur, ar, fa, ps) from input text.
 */
export function autoTranslate5Languages(
  input: string,
  sourceLang: SupportedLanguage = "en",
  currentObj?: Partial<MultilingualText>
): MultilingualText {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return {
      en: currentObj?.en || "",
      ur: currentObj?.ur || "",
      ar: currentObj?.ar || "",
      fa: currentObj?.fa || "",
      ps: currentObj?.ps || "",
    };
  }

  // Check static lookup dictionary
  const key = trimmed.toLowerCase();
  if (COMMON_TRANSLITERATION_MAP[key]) {
    return { ...COMMON_TRANSLITERATION_MAP[key] };
  }

  // Multi-word phrase matching
  const words = trimmed.split(/\s+/);
  const translatedWords = words.map(w => {
    const lk = w.toLowerCase();
    return COMMON_TRANSLITERATION_MAP[lk] || null;
  });

  if (translatedWords.every(Boolean)) {
    return {
      en: translatedWords.map(w => w!.en).join(" "),
      ur: translatedWords.map(w => w!.ur).join(" "),
      ar: translatedWords.map(w => w!.ar).join(" "),
      fa: translatedWords.map(w => w!.fa).join(" "),
      ps: translatedWords.map(w => w!.ps).join(" "),
    };
  }

  // Script detection fallback
  const isArabicScript = detectScriptType(trimmed) === "arabic";

  const result: MultilingualText = {
    en: currentObj?.en || (isArabicScript ? trimmed : trimmed),
    ur: currentObj?.ur || (isArabicScript ? trimmed : trimmed),
    ar: currentObj?.ar || (isArabicScript ? trimmed : trimmed),
    fa: currentObj?.fa || (isArabicScript ? trimmed : trimmed),
    ps: currentObj?.ps || (isArabicScript ? trimmed : trimmed),
  };

  // Set active source language
  result[sourceLang] = trimmed;

  return result;
}

/**
 * Returns text for display in active language with fallback chain.
 */
export function resolveActiveText(
  obj: Partial<MultilingualText> | null | undefined,
  activeLang: SupportedLanguage = "en",
  fallbackDefault = ""
): string {
  if (!obj) return fallbackDefault;
  const langOrder: SupportedLanguage[] = [activeLang, "en", "ur", "ar", "fa", "ps"];
  for (const l of langOrder) {
    const val = obj[l];
    if (val && val.trim()) return val.trim();
  }
  return fallbackDefault;
}
