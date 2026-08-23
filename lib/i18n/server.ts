import { cookies } from "next/headers";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Resolves the active language for a request. The client's `useActiveLanguage()` store is
 * localStorage-backed and can diverge from the `erp_lang` cookie (e.g. a language switch that
 * updates localStorage before the cookie round-trips, or a client fetch made before the cookie
 * write lands). Any caller that already knows the client's live language — API routes whose
 * client wrapper sends `?language=`, or a page that reads it explicitly — MUST pass it as
 * `overrideLang` so the response matches what the user is actually looking at, rather than
 * silently falling back to a possibly-stale cookie.
 */
export async function getRequestLanguage(overrideLang?: string | null): Promise<SupportedLanguage> {
  if (overrideLang && supportedLanguages.some((l) => l.code === overrideLang)) {
    return overrideLang as SupportedLanguage;
  }
  const cookieStore = await cookies();
  const lang = cookieStore.get("erp_lang")?.value;
  if (lang && supportedLanguages.some((l) => l.code === lang)) {
    return lang as SupportedLanguage;
  }
  return "en";
}

