"use client";

import { useEffect, useState } from "react";
import { supportedLanguages, type SupportedLanguage, rtlLanguages, getHtmlLanguage } from "@/lib/i18n/languages";
import { getLanguageKeyboardMap } from "@/lib/i18n/keyboard-layouts";
import { useRouter } from "next/navigation";
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

function getInitialLanguage(): SupportedLanguage {
  if (typeof document === "undefined") return "en";
  const htmlLang = document.documentElement.lang || "en";
  const lang = htmlLang.split("-")[0] as SupportedLanguage;
  return supportedLanguages.some((l) => l.code === lang) ? lang : "en";
}

// Dynamically inject custom web fonts into document head.
function injectWebFonts(lang: SupportedLanguage) {
  if (typeof document === "undefined") return;
  const id = "google-fonts-rtl-injector";
  let link = document.getElementById(id) as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  if (lang === "ar" || lang === "ps") {
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap";
    document.documentElement.style.setProperty("--font-family-override", "'Cairo', sans-serif");
  } else if (lang === "fa") {
    link.href = "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap";
    document.documentElement.style.setProperty("--font-family-override", "'Vazirmatn', sans-serif");
  } else if (lang === "ur") {
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700;800&family=Cairo:wght@400;600;700&display=swap";
    document.documentElement.style.setProperty("--font-family-override", "'Noto Naskh Arabic', 'Cairo', 'Segoe UI', Tahoma, sans-serif");
  } else {
    document.documentElement.style.removeProperty("--font-family-override");
  }
}

export function PreferencesControls() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("day");
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [keyboardMapperActive, setKeyboardMapperActive] = useState(true);

  // Run font injection on load and whenever language state updates.
  useEffect(() => {
    if (mounted) {
      injectWebFonts(language);
    }
  }, [language, mounted]);

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
    const initialLang = getInitialLanguage();
    setLanguage(initialLang);
    document.documentElement.lang = getHtmlLanguage(initialLang);
    document.documentElement.dir = rtlLanguages.includes(initialLang) ? "rtl" : "ltr";
    injectWebFonts(initialLang);

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
      if (event.key === "erp_lang" && event.newValue) {
        const next = event.newValue as SupportedLanguage;
        if (supportedLanguages.some((l) => l.code === next)) {
          setLanguage((prev) => {
            if (prev === next) return prev;
            document.documentElement.lang = getHtmlLanguage(next);
            document.documentElement.dir = rtlLanguages.includes(next) ? "rtl" : "ltr";
            return next;
          });
        }
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

    setLanguage(next);
    injectWebFonts(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("erp_language_changed"));
    }
    router.refresh();
  }

  function changeTheme(next: ThemeMode) {
    applyThemeMode(next);
    localStorage.setItem("erp_theme_mode", next);
    document.cookie = `erp_theme_mode=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    localStorage.setItem("erp_theme", next === "night" ? "dark" : "light");
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
    <div className="flex items-center gap-2">
      {/* Dynamic font styles applied based on override CSS variable */}
      {mounted && (
        <style dangerouslySetInnerHTML={{
          __html: `
            body, input, select, textarea, button, select option {
              font-family: var(--font-family-override, inherit) !important;
            }
          `
        }} />
      )}

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




