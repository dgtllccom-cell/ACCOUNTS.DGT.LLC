import { cookies } from "next/headers";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

export async function getRequestLanguage(): Promise<SupportedLanguage> {
  const cookieStore = await cookies();
  const lang = cookieStore.get("erp_lang")?.value;
  if (lang && supportedLanguages.some((l) => l.code === lang)) {
    return lang as SupportedLanguage;
  }
  return "en";
}

