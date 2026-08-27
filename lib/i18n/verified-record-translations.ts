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

/**
 * The five distinct states the product owner requires for user-entered
 * transactional text (remarks / narration / notes / descriptions):
 *
 *   human_verified        a human confirmed/authored every target language
 *   fully_translated      all target languages present & differ from source, machine-produced
 *   partially_translated  some but not all target languages translated
 *   untranslated          no target language differs from the source text
 *   needs_review          orthogonal flag — true whenever the current values are
 *                         machine-produced (fully OR partially) and not yet human-verified
 *
 * Callers MUST NOT show fully_translated / partially_translated as "completed":
 * only `human_verified` counts as done. Use `needsReview` to drive the review queue.
 */
export type TranslationCoverageStatus =
  | "human_verified"
  | "fully_translated"
  | "partially_translated"
  | "untranslated"
  | "needs_review";

export interface TranslationCoverageReport {
  status: TranslationCoverageStatus;
  needsReview: boolean;
  translatedLanguages: SupportedLanguage[];
  untranslatedLanguages: SupportedLanguage[];
  /** 0..1 — fraction of the 4 non-source languages that carry a distinct translation */
  ratio: number;
}

export function classifyTranslationCoverage(input: {
  originalText: string;
  originalLanguage: SupportedLanguage;
  translations: VerifiedTranslationMap | null | undefined;
  /** true when a human authored/approved the values (engine === "manual" or a stored verified flag) */
  humanVerified?: boolean;
}): TranslationCoverageReport {
  const source = clean(input.originalText);
  const targets = languageCodes.filter((l) => l !== input.originalLanguage);
  const translated: SupportedLanguage[] = [];
  const untranslated: SupportedLanguage[] = [];
  for (const l of targets) {
    const v = clean(input.translations?.[l]);
    if (v && !sameText(v, source)) translated.push(l);
    else untranslated.push(l);
  }
  const ratio = targets.length ? translated.length / targets.length : 1;
  const full = translated.length === targets.length && targets.length > 0;
  const none = translated.length === 0;

  let status: TranslationCoverageStatus;
  if (input.humanVerified && full) status = "human_verified";
  else if (none) status = "untranslated";
  else if (full) status = "fully_translated";
  else status = "partially_translated";

  return {
    status,
    needsReview: !input.humanVerified && !none,
    translatedLanguages: translated,
    untranslatedLanguages: untranslated,
    ratio,
  };
}

export function translationCoverageLabel(status: TranslationCoverageStatus, language: SupportedLanguage): string {
  const L: Record<TranslationCoverageStatus, Record<SupportedLanguage, string>> = {
    human_verified: { en: "Human verified", ur: "انسانی تصدیق شدہ", ar: "مُتحقَّق بشريًا", fa: "تأیید انسانی", ps: "انساني تصدیق شوی" },
    fully_translated: { en: "Fully translated", ur: "مکمل ترجمہ شدہ", ar: "مُترجَم بالكامل", fa: "کاملاً ترجمه‌شده", ps: "بشپړ ژباړل شوی" },
    partially_translated: { en: "Partially translated", ur: "جزوی ترجمہ شدہ", ar: "مُترجَم جزئيًا", fa: "ترجمه جزئی", ps: "جزوي ژباړل شوی" },
    untranslated: { en: "Untranslated", ur: "غیر ترجمہ شدہ", ar: "غير مُترجَم", fa: "ترجمه‌نشده", ps: "نه ژباړل شوی" },
    needs_review: { en: "Needs review", ur: "جائزہ درکار", ar: "يحتاج مراجعة", fa: "نیازمند بازبینی", ps: "بیاکتنې ته اړتیا" },
  };
  return L[status]?.[language] ?? L[status]?.en ?? status;
}
