import { normalizeSupportedLanguage, type SupportedLanguage } from "@/lib/i18n/languages";

export const masterLanguageCodes = ["en", "ur", "ar", "fa", "ps"] as const;
export type MasterLanguageCode = (typeof masterLanguageCodes)[number];

export type MultilingualText = Partial<Record<MasterLanguageCode, string | null | undefined>>;

export type MasterRecord = Record<string, unknown> | null | undefined;

const defaultFallbackKeys = [
  "name",
  "display_name",
  "title",
  "label",
  "goods_name",
  "account_name",
  "customer_name",
  "supplier_name",
  "company_name",
  "bank_name",
  "branch_name",
  "city_name",
  "country_name",
  "category_name",
  "brand_name",
  "unit_name"
];

function asCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getMasterLanguage(value: string | null | undefined): SupportedLanguage {
  return normalizeSupportedLanguage(value, "en");
}

export function multilingualColumn(baseName: string, language: string | null | undefined): string {
  return `${baseName}_${getMasterLanguage(language)}`;
}

export function resolveMultilingualText(text: MultilingualText, language: string | null | undefined, fallback = ""): string {
  const lang = getMasterLanguage(language);
  return (
    asCleanString(text[lang]) ||
    asCleanString(text.en) ||
    asCleanString(text.ur) ||
    asCleanString(text.ar) ||
    asCleanString(text.fa) ||
    asCleanString(text.ps) ||
    fallback
  );
}

export function resolveMultilingualField(
  record: MasterRecord,
  baseName: string,
  language: string | null | undefined,
  fallbackKeys: string[] = defaultFallbackKeys
): string {
  if (!record) return "";
  const lang = getMasterLanguage(language);
  const languageValue = asCleanString(record[`${baseName}_${lang}`]);
  if (languageValue) return languageValue;

  const englishValue = asCleanString(record[`${baseName}_en`]);
  if (englishValue) return englishValue;

  for (const code of masterLanguageCodes) {
    const value = asCleanString(record[`${baseName}_${code}`]);
    if (value) return value;
  }

  for (const key of fallbackKeys) {
    const value = asCleanString(record[key]);
    if (value) return value;
  }

  return "";
}

export function resolveMasterName(record: MasterRecord, language: string | null | undefined): string {
  return resolveMultilingualField(record, "name", language);
}

export function buildMultilingualPatch(
  baseName: string,
  value: string | null | undefined,
  sourceLanguage: string | null | undefined = "en"
): Record<string, string | null> {
  const clean = asCleanString(value) || null;
  const lang = getMasterLanguage(sourceLanguage);
  const patch: Record<string, string | null> = {};
  for (const code of masterLanguageCodes) {
    patch[`${baseName}_${code}`] = code === lang ? clean : null;
  }
  if (clean && lang !== "en") patch[`${baseName}_en`] = clean;
  return patch;
}

export function localizeMasterRows<T extends Record<string, unknown>>(
  rows: T[],
  language: string | null | undefined,
  fields: Array<{ baseName: string; outputKey?: string; fallbackKeys?: string[] }>
): Array<T & Record<string, string>> {
  return rows.map((row) => {
    const localized: T & Record<string, string> = { ...row } as T & Record<string, string>;
    for (const field of fields) {
      localized[field.outputKey ?? field.baseName] = resolveMultilingualField(
        row,
        field.baseName,
        language,
        field.fallbackKeys ?? defaultFallbackKeys
      );
    }
    return localized;
  });
}
