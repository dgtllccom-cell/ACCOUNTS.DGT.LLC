"use client";

import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

/**
 * Saved business text shown as it was saved, with a small marker when it is NOT in the viewer's language and no approved
 * version exists yet (the API already resolved any approved translation into `value`). Issue #36: an English viewer of a name
 * typed in Urdu sees the saved name — honestly marked — instead of an unverified machine re-spelling; the marker's title says
 * why. The text is bidi-isolated so Urdu inside an English row (and English inside an RTL row) keeps its own direction.
 */

const PERSO_ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const PASHTO_LETTERS = /[ټډړښږځڅګڼۍې]/;
const URDU_LETTERS = /[ٹڈڑںےھہ]/;
const NATIVE_NAME: Record<SupportedLanguage, string> = { en: "English", ur: "اردو", ar: "العربية", fa: "فارسی", ps: "پښتو" };
const CHIP: Record<SupportedLanguage, string> = { en: "EN", ur: "UR", ar: "AR", fa: "FA", ps: "PS" };

/** The language a saved value reads in, by its script (Perso-Arabic text without Urdu / Pashto letters counts as Urdu). */
export function savedValueLanguage(input: string): SupportedLanguage | null {
  const value = input.replace(/[٠-٩۰-۹]/g, ""); // letters decide, not Eastern digits
  if (PERSO_ARABIC.test(value)) {
    if (PASHTO_LETTERS.test(value)) return "ps";
    if (URDU_LETTERS.test(value)) return "ur";
    return "ur";
  }
  // a code / reference ("PK-QTA-AC-0001") is in no language
  if (/^[A-Z0-9][A-Z0-9._/\s-]*$/.test(value.trim()) && /[\d-]/.test(value)) return null;
  return LATIN_WORD.test(value) ? "en" : null;
}

/** True when the viewer cannot read the saved value in their own script (Latin vs Perso-Arabic). */
export function isOtherScriptValue(value: string | null | undefined, lang: SupportedLanguage): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const saved = savedValueLanguage(text);
  if (!saved) return false;
  return lang === "en" ? saved !== "en" : saved === "en";
}

export function SavedText({
  value,
  lang,
  kind = "text",
  className,
  fallback = "—"
}: {
  value: string | null | undefined;
  lang: SupportedLanguage;
  /** "name": a legal / person name (approved name variant pending); "text": free text or a term. */
  kind?: "name" | "text";
  className?: string;
  fallback?: string;
}) {
  const text = String(value ?? "").trim();
  if (!text) return <span className={className}>{fallback}</span>;
  if (!isOtherScriptValue(text, lang)) return <bdi dir="auto" className={className}>{text}</bdi>;
  const saved = savedValueLanguage(text) ?? "en";
  const title = (kind === "name"
    ? t(lang, "tr.pending_name_title", "Saved name ({lang}). No approved name in this language yet.")
    : t(lang, "tr.pending_title", "Saved in {lang}. No approved translation in this language yet.")
  ).replace("{lang}", NATIVE_NAME[saved]);
  return (
    <span className={className} title={title} data-saved-lang={saved} data-translation-pending="true">
      <bdi dir="auto">{text}</bdi>
      {/* the chip is drawn from an attribute, so the cell's text (copy, search, exports, tests) stays exactly the saved value */}
      <span
        aria-hidden="true"
        data-chip={CHIP[saved]}
        className="ms-1 inline-flex select-none items-center rounded border border-amber-300 bg-amber-50 px-1 align-middle text-[9px] font-bold leading-4 text-amber-700 after:content-[attr(data-chip)] dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      />
    </span>
  );
}
