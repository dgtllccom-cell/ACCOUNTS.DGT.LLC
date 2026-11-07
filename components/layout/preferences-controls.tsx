"use client";

import React, { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { supportedLanguages, type SupportedLanguage, rtlLanguages, getHtmlLanguage } from "@/lib/i18n/languages";
import { getLanguageKeyboardMap } from "@/lib/i18n/keyboard-layouts";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/ui";
import { applyThemeMode, themeModeIsDark, legacyThemeMode, normalizeThemeMode, type ThemeMode } from "@/lib/ui/theme-modes";
import { QuickPreferencesPopover } from "@/components/layout/quick-preferences-popover";

function getInitialThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "day";
  const dataMode = document.documentElement.dataset.erpThemeMode;
  const storedMode = localStorage.getItem("erp_theme_mode");
  const legacyMode = localStorage.getItem("erp_theme");
  return normalizeThemeMode(dataMode || storedMode || legacyThemeMode(legacyMode));
}

export function PreferencesControls() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("day");
  const language = useActiveLanguage();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [keyboardMapperActive, setKeyboardMapperActive] = useState(true);

  // Run font injection on load and whenever language state updates.
  // Handle global key events for virtual layout mapping.
  useEffect(() => {
    if (!keyboardMapperActive || !rtlLanguages.includes(language)) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (!isInput) return;

      // Skip common modifiers/control keys.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const langMap = getLanguageKeyboardMap(language);
      if (!langMap) return;

      const mappedChar = langMap[e.key];
      if (mappedChar === undefined) return;

      // Block normal input typing and insert mapped Unicode character at cursor.
      e.preventDefault();

      const input = target as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const val = input.value;
      const newVal = val.substring(0, start) + mappedChar + val.substring(end);

      const prototype = input.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

      if (nativeSetter) {
        nativeSetter.call(input, newVal);
      } else {
        input.value = newVal;
      }

      const nextCursor = start + mappedChar.length;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.setSelectionRange(nextCursor, nextCursor);
      requestAnimationFrame(() => {
        if (document.activeElement === input) {
          input.setSelectionRange(nextCursor, nextCursor);
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [language, keyboardMapperActive]);

  useEffect(() => {
    setMounted(true);
    setThemeMode(getInitialThemeMode());

    const onStorage = (event: StorageEvent) => {
      if (event.key === "erp_theme_mode") {
        const next = normalizeThemeMode(event.newValue);
        applyThemeMode(next);
        setThemeMode(next);
      } else if (event.key === "erp_theme") {
        const next = normalizeThemeMode(legacyThemeMode(event.newValue));
        applyThemeMode(next);
        setThemeMode(next);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function changeLanguage(next: SupportedLanguage) {
    document.documentElement.lang = getHtmlLanguage(next);
    document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
    localStorage.setItem("erp_lang", next);
    document.cookie = `erp_lang=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Clear legacy Google Translate cookies if present
    document.cookie = "googtrans=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("erp_language_changed"));
    }
    router.refresh();
  }

  function changeTheme(next: ThemeMode) {
    applyThemeMode(next);
    localStorage.setItem("erp_theme_mode", next);
    document.cookie = `erp_theme_mode=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    localStorage.setItem("erp_theme", themeModeIsDark(next) ? "dark" : "light");
    setThemeMode(next);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/erp/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  }

  const isRtlLangActive = rtlLanguages.includes(language);

  return (
    <div className="erp-preferences flex items-center gap-1 sm:gap-2">
      <label className="erp-language-select">
        <Languages className="h-4 w-4 shrink-0" aria-hidden />
        <select aria-label={t(language, "nav.language")} value={language} onChange={(event) => changeLanguage(event.target.value as SupportedLanguage)}>
          {supportedLanguages.map((option) => <option key={option.code} value={option.code} lang={option.htmlLang} dir={option.direction}>{option.nativeName}</option>)}
        </select>
      </label>

      <QuickPreferencesPopover
        language={language}
        themeMode={themeMode}
        keyboardMapperActive={keyboardMapperActive}
        showKeyboardMapper={mounted && isRtlLangActive}
        showLogout
        isLoggingOut={isLoggingOut}
        onLanguageChange={changeLanguage}
        onThemeChange={changeTheme}
        onToggleKeyboardMapper={() => setKeyboardMapperActive((current) => !current)}
        onLogout={handleLogout}
        triggerLabel={mounted ? t(language, "common.settings") : "Settings"}
      />
    </div>
  );
}




