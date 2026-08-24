"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { rtlLanguages, getHtmlLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { applyThemeMode, legacyThemeMode, normalizeThemeMode, type ThemeMode } from "@/lib/ui/theme-modes";
import { QuickPreferencesPopover } from "@/components/layout/quick-preferences-popover";

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

  useEffect(() => {
    setMounted(true);
    setThemeMode(getInitialThemeMode());
  }, []);

  function changeLanguage(next: SupportedLanguage) {
    document.documentElement.lang = getHtmlLanguage(next);
    document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
    localStorage.setItem("erp_lang", next);
    document.cookie = `erp_lang=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Clear legacy Google Translate cookies if present
    document.cookie = "googtrans=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    
    window.location.reload();
  }

  function changeTheme(next: ThemeMode) {
    applyThemeMode(next);
    localStorage.setItem("erp_theme_mode", next);
    document.cookie = `erp_theme_mode=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    localStorage.setItem("erp_theme", next === "night" ? "dark" : "light");
    setThemeMode(next);
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

      <QuickPreferencesPopover
        language={lang}
        themeMode={themeMode}
        showKeyboardMapper={false}
        showLogout={false}
        onLanguageChange={changeLanguage}
        onThemeChange={changeTheme}
        triggerLabel={mounted ? t(lang, "common.settings") : "Settings"}
        triggerClassName="border-white/15 bg-white/5 text-white/95 hover:bg-white/10 hover:text-white shadow-none"
      />
    </div>
  );
}

