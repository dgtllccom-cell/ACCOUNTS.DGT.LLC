"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { supportedLanguages, rtlLanguages, getHtmlLanguage, type SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

/**
 * Self-contained language switcher for the public DGT Mail app (outside the
 * ERP dashboard shell). Writes the exact same localStorage key / cookie /
 * event that components/layout/preferences-controls.tsx uses, so
 * useActiveLanguage() picks it up immediately without any ERP session.
 */
export function changePublicMailLanguage(next: SupportedLanguage) {
  document.documentElement.lang = getHtmlLanguage(next);
  document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
  localStorage.setItem("erp_lang", next);
  document.cookie = `erp_lang=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  window.dispatchEvent(new Event("erp_language_changed"));
}

export function MailLanguageSwitcher({ language }: { language: SupportedLanguage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={t(language, "mail.language_label", "Language")}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.nativeName}</span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-44 rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50">
          {supportedLanguages.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                changePublicMailLanguage(l.code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                l.code === language
                  ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{l.nativeName}</span>
              {l.code !== "en" && <span className="text-[10px] text-slate-400">{l.englishName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
