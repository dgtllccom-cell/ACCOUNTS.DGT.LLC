import { translateHeader } from "@/lib/i18n/table-headers";

/** Active ERP language for print builders that run outside React (same sources as the print engines). */
function activeLang(): string {
  if (typeof document === "undefined") return "en";
  try {
    return localStorage.getItem("erp_lang") || document.documentElement.lang || "en";
  } catch {
    return document.documentElement.lang || "en";
  }
}

/** Localize a print column / filter label through the central header dictionary. */
export function pl(text: string): string {
  return translateHeader(activeLang(), text);
}
