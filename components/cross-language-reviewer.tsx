"use client";

import { useEffect, useMemo, useState } from "react";
import { Languages, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

/**
 * CrossLanguageReviewer — one business entry, read in the reviewer's language.
 *
 * The speaker/author's ORIGINAL text and ORIGINAL language are always shown
 * verbatim and are never mutated. A reviewer who does not read that language
 * can request a reading in English or Urdu through the central ERP translation
 * endpoint (`/api/erp/i18n/translate` — approved glossary → memory → local →
 * optional external, learned once).
 *
 * Translation is for COMPREHENSION ONLY. Amounts, dates, serial numbers, bill /
 * invoice numbers and other identifiers are detected in the original and pinned
 * in a "verify against the original" strip so a reviewer never trusts a
 * translated number. Nothing here posts or edits the entry.
 */

// Derived from the central language registry — not a parallel UI dictionary.
const LANG_LABEL = Object.fromEntries(
  supportedLanguages.map((l) => [l.code, l.nativeName]),
) as Record<SupportedLanguage, string>;
const RTL = supportedLanguages.filter((l) => l.direction === "rtl").map((l) => l.code) as SupportedLanguage[];

/** Amounts, ISO / d-m-y dates, and reference-like tokens — never altered, only surfaced. */
function extractInvariants(text: string): { amounts: string[]; dates: string[]; refs: string[] } {
  const amounts = Array.from(
    text.matchAll(/(?:[A-Z]{3}\s*)?[\d٠-٩۰-۹][\d٠-٩۰-۹.,]*(?:\s*[A-Z]{3})?/g),
  )
    .map((m) => m[0].trim())
    .filter((s) => /[\d٠-٩۰-۹]/.test(s) && s.replace(/[^\d٠-٩۰-۹]/g, "").length >= 2);
  const dates = Array.from(
    text.matchAll(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g),
  ).map((m) => m[0]);
  const refs = Array.from(
    text.matchAll(/\b(?:INV|BL|PO|SO|DSA|REF|NO|#)[-\s:]*[A-Z0-9][A-Z0-9-]{2,}\b/gi),
  ).map((m) => m[0].trim());
  const uniq = (a: string[]) => Array.from(new Set(a));
  return { amounts: uniq(amounts).slice(0, 12), dates: uniq(dates).slice(0, 8), refs: uniq(refs).slice(0, 8) };
}

export function CrossLanguageReviewer({
  originalText,
  originalLanguage,
  domain = "general",
  className,
}: {
  originalText: string | null | undefined;
  originalLanguage?: string | null;
  domain?: string;
  className?: string;
}) {
  const s = useErpScreen("xlr");
  const srcLang = (["en", "ur", "ar", "fa", "ps"].includes(String(originalLanguage))
    ? (originalLanguage as SupportedLanguage)
    : "en") as SupportedLanguage;
  const [readLang, setReadLang] = useState<SupportedLanguage>(srcLang === "en" ? "ur" : "en");
  const [translation, setTranslation] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = (originalText || "").trim();
  const invariants = useMemo(() => extractInvariants(text), [text]);

  useEffect(() => {
    setTranslation(null);
    setEngine(null);
    setError(null);
    if (!text || readLang === srcLang) return;
    let alive = true;
    setLoading(true);
    fetch("/api/erp/i18n/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text, sourceLang: srcLang, targetLang: readLang, domain }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.data?.translation || j?.translation) {
          setTranslation(j.data?.translation ?? j.translation);
          setEngine(j.data?.engine ?? j.engine ?? null);
        } else {
          setError(s.t("unavailable", "Translation is temporarily unavailable — read the original."));
        }
      })
      .catch(() => alive && setError(s.t("unavailable", "Translation is temporarily unavailable — read the original.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [text, srcLang, readLang, domain, s]);

  if (!text) return null;

  return (
    <div
      className={`rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/20 ${className || ""}`}
      dir={s.dir}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-sky-800 dark:text-sky-300">
          <Languages className="h-3.5 w-3.5" />
          {s.t("title", "Cross-language review")}
        </span>
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-900 dark:text-sky-200">
          {s.t("spoken_in", "Original language")}: {LANG_LABEL[srcLang]}
        </span>
      </div>

      {/* ORIGINAL — verbatim, never altered */}
      <div className="mt-2 rounded-lg bg-white p-2 dark:bg-slate-900">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {s.t("original", "Original (unchanged)")}
        </p>
        <p
          className="mt-0.5 whitespace-pre-wrap text-slate-800 dark:text-slate-100"
          dir={RTL.includes(srcLang) ? "rtl" : "ltr"}
        >
          {text}
        </p>
      </div>

      {/* Reviewer reading */}
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {s.t("read_as", "Read as")}:
          </span>
          {(["en", "ur"] as SupportedLanguage[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setReadLang(l)}
              className={`rounded px-2 py-0.5 text-[11px] font-bold transition ${
                readLang === l
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>

        {readLang === srcLang ? (
          <p className="mt-1.5 text-[11px] italic text-slate-400">
            {s.t("same_lang", "The original is already in this language.")}
          </p>
        ) : loading ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {s.t("translating", "Preparing reading…")}
          </p>
        ) : error ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        ) : translation ? (
          <div className="mt-1.5 rounded-lg bg-white p-2 dark:bg-slate-900">
            <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100" dir={RTL.includes(readLang) ? "rtl" : "ltr"}>
              {translation}
            </p>
            {engine ? (
              <p className="mt-1 text-[10px] text-slate-400">
                {s.t("engine", "Reading source")}: {engine}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Invariants — verify against the original, never trust the translation */}
      {(invariants.amounts.length > 0 || invariants.dates.length > 0 || invariants.refs.length > 0) && (
        <div className="mt-2 rounded-lg bg-amber-50 p-2 dark:bg-amber-950/30">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {s.t("verify_note", "Numbers, dates and reference IDs are taken from the original and are never changed by translation — verify each against the original above.")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...invariants.amounts, ...invariants.dates, ...invariants.refs].map((v, i) => (
              <span
                key={i}
                dir="ltr"
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-slate-900 dark:text-amber-200"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 text-[10px] text-slate-400">
        {s.t("one_entry_note", "This is one business entry. The translated reading is for understanding only — it does not create a separate record and nothing is posted from here.")}
      </p>
    </div>
  );
}
