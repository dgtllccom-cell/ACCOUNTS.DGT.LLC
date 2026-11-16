import type { SupportedLanguage } from "./languages";

function supported(value: string | null | undefined): SupportedLanguage | null {
  const base = value?.trim().split("-")[0].toLowerCase();
  return base && ["en", "ur", "ar", "fa", "ps"].includes(base) ? base as SupportedLanguage : null;
}

/** Same language source for API requests and reactive screen labels. */
export function readBrowserLanguage(): SupportedLanguage | null {
  if (typeof document === "undefined") return null;
  try {
    const stored = supported(localStorage.getItem("erp_lang"));
    if (stored) return stored;
  } catch {
    // Browser privacy settings may deny storage access; the page language still works.
  }
  return supported(document.documentElement.lang);
}
