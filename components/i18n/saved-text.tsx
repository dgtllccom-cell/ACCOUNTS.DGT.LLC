"use client";

import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { autoLocalizeName, autoNameSource } from "@/lib/i18n/transliteration";

/**
 * Saved business text in the viewer's language. Names (kind="name"): owner decision 28-Nov replaces Issue #36 — a name with no
 * approved version is shown automatically converted into the viewer's script by the local dictionary / translator, with a
 * small "auto" chip whose title gives the saved name (the database value is never changed). Free text (kind="text") keeps the
 * Issue #36 behaviour: shown as saved with a language chip until an approved translation exists. Text is bidi-isolated.
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
  if (kind === "name") {
    // Owner decision 28-Nov: a name is shown in the viewer's script — curated variant, else an automatic conversion marked
    // "auto" (the saved name in the database is never changed). Callers may pass the saved name or an already-converted one.
    const alreadyAuto = autoNameSource(text, lang);
    const resolved = alreadyAuto === undefined ? autoLocalizeName(text, lang) : { text, auto: true, saved: alreadyAuto };
    if (resolved.auto) {
      return (
        <span className={className} title={t(lang, "tr.auto_name_title", "Converted automatically from the saved name: {name}").replace("{name}", resolved.saved)} data-auto-name="true" data-saved-name={resolved.saved}>
          <bdi dir="auto">{resolved.text}</bdi>
          <span
            aria-hidden="true"
            data-chip={t(lang, "tr.auto_name_chip", "auto")}
            className="ms-1 inline-flex select-none items-center rounded border border-sky-300 bg-sky-50 px-1 align-middle text-[10px] font-bold leading-4 text-sky-700 after:content-[attr(data-chip)] dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
          />
        </span>
      );
    }
    if (resolved.text.trim() && resolved.text.trim() !== text) return <bdi dir="auto" className={className}>{resolved.text}</bdi>; // curated variant
  }
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
        className="ms-1 inline-flex select-none items-center rounded border border-amber-300 bg-amber-50 px-1 align-middle text-[11px] font-bold leading-4 text-amber-700 after:content-[attr(data-chip)] dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      />
    </span>
  );
}
