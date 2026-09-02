import { cookies, headers } from "next/headers";
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
  const valid = (v: string | null | undefined): v is SupportedLanguage =>
    !!v && supportedLanguages.some((l) => l.code === v);

  // 1. explicit override (route read ?lang= / ?language= and passed it)
  if (valid(overrideLang)) return overrideLang;

  // 2. the live client language, sent as a header by lib/api/client.ts on every request —
  //    this is authoritative even when the erp_lang cookie has not round-tripped yet.
  try {
    const h = await headers();
    const headerLang = h.get("x-erp-lang");
    if (valid(headerLang)) return headerLang;
  } catch {
    /* headers() unavailable in this context — fall through to cookie */
  }

  // 3. the erp_lang cookie
  const cookieStore = await cookies();
  const lang = cookieStore.get("erp_lang")?.value;
  if (valid(lang)) return lang;

  return "en";
}

