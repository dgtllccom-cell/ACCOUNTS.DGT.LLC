import { getHtmlLanguage, getLanguageDirection, type SupportedLanguage } from "@/lib/i18n/languages";

export function getLocalizedInputProps(language: SupportedLanguage) {
  return {
    lang: getHtmlLanguage(language),
    dir: getLanguageDirection(language),
    "data-erp-language": language,
    autoCapitalize: language === "en" ? "sentences" : "off",
    spellCheck: language === "en"
  } as const;
}
