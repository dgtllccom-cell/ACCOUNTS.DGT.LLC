"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, HelpCircle, Palette } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { supportedLanguages, rtlLanguages } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { applyThemeMode, legacyThemeMode, normalizeThemeMode, themeModes, type ThemeMode } from "@/lib/ui/theme-modes";

function getInitialThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "day";
  const dataMode = document.documentElement.dataset.erpThemeMode;
  const storedMode = localStorage.getItem("erp_theme_mode");
  const legacyMode = localStorage.getItem("erp_theme");
  return normalizeThemeMode(dataMode || storedMode || legacyThemeMode(legacyMode));
}

export function AuthTopControls({ lang }: { lang: SupportedLanguage }) {
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("day");

  const languageOptions = useMemo(() => supportedLanguages, []);
  const themeLabels = useMemo(() => ({
    night: t(lang, "nav.theme_night"),
    day: t(lang, "nav.theme_day"),
    soft: t(lang, "nav.theme_soft"),
    green: t(lang, "nav.theme_green_business")
  }), [lang]);

  useEffect(() => {
    setMounted(true);
    setThemeMode(getInitialThemeMode());
  }, []);

  function changeLanguage(next: SupportedLanguage) {
    document.documentElement.lang = next;
    document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
    localStorage.setItem("erp_lang", next);
    document.cookie = `erp_lang=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Clear legacy Google Translate cookies if present
    document.cookie = "googtrans=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    
    window.location.reload();
  }

  return (
    <div className="flex items-center justify-end gap-3 text-white/90">
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="hidden items-center gap-2 text-sm font-medium hover:text-white md:inline-flex"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        {t(lang, "auth.support")}
      </a>

      <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs md:flex">
        <Globe2 className="h-4 w-4" aria-hidden />
        <select
          className={cn("bg-transparent text-xs font-semibold outline-none", mounted ? "" : "opacity-0")}
          value={lang}
          onChange={(e) => changeLanguage(e.target.value as SupportedLanguage)}
          aria-label="Language"
        >
          {languageOptions.map((l) => (
            <option key={l.code} value={l.code} className="text-slate-900 font-bold bg-white">
              {l.englishName === l.nativeName ? l.englishName : `${l.englishName} - ${l.nativeName}`}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs md:flex">
        <Palette className="h-4 w-4" aria-hidden />
        <select
          className={cn("bg-transparent text-xs font-semibold outline-none", mounted ? "" : "opacity-0")}
          value={themeMode}
          onChange={(e) => {
            const next = normalizeThemeMode(e.target.value);
            applyThemeMode(next);
            localStorage.setItem("erp_theme_mode", next);
            document.cookie = `erp_theme_mode=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
            localStorage.setItem("erp_theme", next === "night" ? "dark" : "light");
            setThemeMode(next);
          }}
          aria-label={t(lang, "nav.theme_mode")}
        >
          {themeModes.map((mode) => (
            <option key={mode.id} value={mode.id} className="text-slate-900 font-bold bg-white">
              {themeLabels[mode.id]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

