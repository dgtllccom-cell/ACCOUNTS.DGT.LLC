export const supportedLanguages = [
  {
    code: "en",
    englishName: "English",
    nativeName: "English",
    htmlLang: "en",
    direction: "ltr",
    isDefault: true
  },
  {
    code: "ar",
    englishName: "Arabic",
    nativeName: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    htmlLang: "ar",
    direction: "rtl",
    isDefault: false
  },
  {
    code: "ur",
    englishName: "Urdu",
    nativeName: "\u0627\u0631\u062F\u0648",
    htmlLang: "ur-PK",
    direction: "rtl",
    isDefault: false
  },
  {
    code: "fa",
    englishName: "Persian / Farsi",
    nativeName: "\u0641\u0627\u0631\u0633\u06CC",
    htmlLang: "fa",
    direction: "rtl",
    isDefault: false
  },
  {
    code: "ps",
    englishName: "Pashto",
    nativeName: "\u067E\u069A\u062A\u0648",
    htmlLang: "ps",
    direction: "rtl",
    isDefault: false
  }
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];
export type LanguageDirection = (typeof supportedLanguages)[number]["direction"];

export const rtlLanguages: SupportedLanguage[] = supportedLanguages
  .filter((language) => language.direction === "rtl")
  .map((language) => language.code);

export function getLanguageDirection(languageCode: SupportedLanguage): LanguageDirection {
  return supportedLanguages.find((language) => language.code === languageCode)?.direction ?? "ltr";
}

export function getHtmlLanguage(languageCode: SupportedLanguage): string {
  return supportedLanguages.find((language) => language.code === languageCode)?.htmlLang ?? languageCode;
}

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return supportedLanguages.some((language) => language.code === value);
}

export function normalizeSupportedLanguage(value: string | null | undefined, fallback: SupportedLanguage = "en"): SupportedLanguage {
  return isSupportedLanguage(value) ? value : fallback;
}

