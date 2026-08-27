"use client";

/**
 * useErpScreen() — the single hook every ERP screen (page, form, modal, report,
 * table, widget, print/export builder) uses to become five-language-aware.
 *
 * It packages, in one call, everything CLAUDE.md requires:
 *   - the active ERP language (reactive: cookie / localStorage `erp_lang` / <html lang>)
 *   - the server-thread `lang` prop reconciliation (activeLang wins unless it is "en")
 *   - RTL/LTR direction + logical alignment helpers
 *   - a namespaced translator bound to the central dictionary (lib/i18n/ui.ts)
 *
 * Usage:
 *   const s = useErpScreen("bankroz", langProp);
 *   <div dir={s.dir}>
 *     <h1>{s.t("title", "Bank Roznamcha")}</h1>
 *     <th className={s.textStart}>{s.t("col_amount", "Amount")}</th>
 *   </div>
 *
 * Never build a parallel { en, ur, ar, fa, ps } object in a component — add the key
 * to lib/i18n/ui.ts (all five blocks) and call s.t("key", "English fallback").
 */

import { useCallback, useMemo } from "react";
import { useActiveLanguage } from "./use-active-language";
import { t as centralT } from "./ui";
import type { SupportedLanguage } from "./languages";

export const RTL_LANGUAGES: readonly SupportedLanguage[] = ["ur", "ar", "fa", "ps"] as const;

export function isRtlLanguage(lang: string | null | undefined): boolean {
  return !!lang && (RTL_LANGUAGES as readonly string[]).includes(lang);
}

export interface ErpScreen {
  /** The language the whole screen must render in. */
  lang: SupportedLanguage;
  /** true for ur / ar / fa / ps. */
  isRtl: boolean;
  /** "rtl" | "ltr" — put on the screen root and on any print/PDF <html>. */
  dir: "rtl" | "ltr";
  /** Tailwind logical-alignment helpers that follow `dir`. */
  textStart: "text-left" | "text-right";
  textEnd: "text-left" | "text-right";
  /**
   * Translate `${namespace}.${key}` from the central dictionary, with an English
   * fallback. `namespace` is fixed at hook-call time.
   */
  t: (key: string, fallback: string) => string;
  /** Translate a fully-qualified central key (its own namespace), with fallback. */
  tGlobal: (fullKey: string, fallback: string) => string;
}

/**
 * @param namespace  dictionary prefix for this screen, e.g. "bankroz", "pbjr", "nav".
 * @param langProp   optional server-threaded language prop; reconciled per CLAUDE.md.
 */
export function useErpScreen(namespace: string, langProp?: string | null): ErpScreen {
  const activeLang = useActiveLanguage();
  const lang: SupportedLanguage =
    activeLang !== "en"
      ? activeLang
      : (langProp && (["en", "ur", "ar", "fa", "ps"] as string[]).includes(langProp)
          ? (langProp as SupportedLanguage)
          : "en");

  const isRtl = isRtlLanguage(lang);

  const t = useCallback(
    (key: string, fallback: string) => centralT(lang, `${namespace}.${key}`, fallback),
    [lang, namespace],
  );
  const tGlobal = useCallback(
    (fullKey: string, fallback: string) => centralT(lang, fullKey, fallback),
    [lang],
  );

  return useMemo<ErpScreen>(
    () => ({
      lang,
      isRtl,
      dir: isRtl ? "rtl" : "ltr",
      textStart: isRtl ? "text-right" : "text-left",
      textEnd: isRtl ? "text-left" : "text-right",
      t,
      tGlobal,
    }),
    [lang, isRtl, t, tGlobal],
  );
}
