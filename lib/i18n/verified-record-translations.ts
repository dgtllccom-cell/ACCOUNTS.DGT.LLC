import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { autoTranslateText, type TranslationMap } from "@/lib/services/auto-translation-service";
import { translateText } from "@/lib/services/multilingual-service";

export type VerifiedTranslationMap = Partial<Record<SupportedLanguage, string>>;
export type VerifiedTranslationSet = {
  translations: VerifiedTranslationMap;
  missingLanguages: SupportedLanguage[];
  status: "complete" | "pending";
  engine: "local_dictionary" | "local_transliteration" | "manual" | "pending";
};

const languageCodes = supportedLanguages.map((language) => language.code);
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const sameText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;

export function validateManualTranslationInput(input: {
  fieldName: string;
  originalText: string;
  originalLanguage: SupportedLanguage;
  translations: VerifiedTranslationMap;
}) {
  const originalText = clean(input.originalText);
  const suppliedOriginal = clean(input.translations[input.originalLanguage]);
  if (suppliedOriginal && suppliedOriginal !== originalText) return `${input.fieldName}: original source text cannot be changed here.`;
  for (const language of languageCodes) {
    const target = clean(input.translations[language]);
    if (language !== input.originalLanguage && target && sameText(target, originalText)) {
      return `${input.fieldName}.${language}: unchanged source text is not a verified translation.`;
    }
  }
  return null;
}

export async function buildVerifiedTranslationSet(input: {
  value: string;
  originalLanguage: SupportedLanguage;
  mode?: "translate" | "transliterate";
  supplied?: VerifiedTranslationMap;
}): Promise<VerifiedTranslationSet> {
  const value = clean(input.value);
  const mode = input.mode ?? "translate";
  if (!value) return { translations: {}, missingLanguages: [], status: "complete", engine: "pending" };
  const generated = await autoTranslateText(value, input.originalLanguage, mode);
  const dictionary = translateText(value);
  const dictionaryHit = languageCodes.some((language) => language !== input.originalLanguage && clean((dictionary as TranslationMap)[language]) && !sameText(clean((dictionary as TranslationMap)[language]), value));
  // POLICY: never auto-approve a machine-guessed spelling. Only a genuine dictionary hit
  // (or a human-supplied `manual` value) may be stored. Proper nouns with no approved
  // translation stay original and are flagged needs_review — we do NOT transliterate-guess.
  // (Previously `mode === "transliterate"` allowed generated transliterations through.)
  const canUseGenerated = dictionaryHit;
  const translations: VerifiedTranslationMap = { [input.originalLanguage]: value };
  let usedManual = false;
  let usedGenerated = false;
  for (const language of languageCodes) {
    if (language === input.originalLanguage) continue;
    const manual = clean(input.supplied?.[language]);
    const generatedCandidate = canUseGenerated ? clean((generated as TranslationMap)[language]) : "";
    const candidate = manual || generatedCandidate;
    if (!candidate || sameText(candidate, value)) continue;
    translations[language] = candidate;
    usedManual ||= Boolean(manual);
    usedGenerated ||= !manual;
  }
  const missingLanguages = languageCodes.filter((language) => !clean(translations[language]));
  return {
    translations,
    missingLanguages,
    status: missingLanguages.length === 0 ? "complete" : "pending",
    engine: usedManual ? "manual" : usedGenerated ? (mode === "transliterate" ? "local_transliteration" : "local_dictionary") : "pending"
  };
}

export function resolveVerifiedTranslation(translations: VerifiedTranslationMap | null | undefined, language: SupportedLanguage) {
  return clean(translations?.[language]) || null;
}

export function translationPendingLabel(language: SupportedLanguage) {
  return ({ en: "Translation pending", ur: "ترجمہ زیرِ التوا ہے", ar: "الترجمة معلّقة", fa: "ترجمه در انتظار است", ps: "ژباړه پاتې ده" } as const)[language];
}
